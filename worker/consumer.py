"""Redis Streams consumer — reads reservation events and dispatches to saga."""

import asyncio

import asyncpg
import redis.asyncio as aioredis
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from internal.constants import ORDER_STREAM_KEY, CONSUMER_GROUP_NAME, CONSUMER_NAME_PREFIX
from internal.logging import get_logger
from worker.saga import execute_reservation_saga, SagaCompensationError

logger = get_logger(__name__)


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((aioredis.ConnectionError, OSError)),
    reraise=True,
)
async def ensure_consumer_group(redis: aioredis.Redis, stream_key: str) -> None:
    """Create consumer group if it doesn't exist. Retries on connection failure."""
    try:
        await redis.xgroup_create(stream_key, CONSUMER_GROUP_NAME, id="0", mkstream=True)
        logger.info("consumer_group_created", stream=stream_key, group=CONSUMER_GROUP_NAME)
    except aioredis.ResponseError as e:
        if "BUSYGROUP" in str(e):
            logger.debug("consumer_group_exists", stream=stream_key)
        else:
            raise


async def consume_orders(
    redis: aioredis.Redis,
    db: asyncpg.Pool,
    product_id: str,
    shutdown_event: asyncio.Event,
    consumer_name: str = f"{CONSUMER_NAME_PREFIX}_1",
    batch_size: int = 10,
    block_ms: int = 2000,
) -> None:
    """Continuously read from order stream and dispatch to saga.

    Args:
        redis: Async Redis connection.
        db: Async PostgreSQL pool.
        product_id: Product ID to consume orders for.
        shutdown_event: Set this event to trigger graceful shutdown.
        consumer_name: Unique consumer identifier within the group.
        batch_size: Max messages per XREADGROUP call.
        block_ms: Block timeout in milliseconds (shorter = faster shutdown response).
    """
    stream_key = ORDER_STREAM_KEY.format(product_id=product_id)
    await ensure_consumer_group(redis, stream_key)

    logger.info(
        "consumer_started",
        stream=stream_key,
        consumer=consumer_name,
        batch_size=batch_size,
    )

    # First, reclaim any pending messages from previous crashes
    await _process_pending_messages(redis, db, stream_key, consumer_name)

    while not shutdown_event.is_set():
        try:
            messages = await redis.xreadgroup(
                groupname=CONSUMER_GROUP_NAME,
                consumername=consumer_name,
                streams={stream_key: ">"},
                count=batch_size,
                block=block_ms,
            )

            if not messages:
                continue

            for stream, entries in messages:
                for message_id, data in entries:
                    await _process_message(redis, db, stream_key, message_id, data)

        except asyncio.CancelledError:
            logger.info("consumer_cancelled")
            break
        except aioredis.ConnectionError as exc:
            logger.error("consumer_redis_connection_lost", error=str(exc))
            await asyncio.sleep(2)
        except Exception as exc:
            logger.error("consumer_loop_error", error=str(exc))
            await asyncio.sleep(1)

    logger.info("consumer_shutdown_complete", consumer=consumer_name)


async def _process_pending_messages(
    redis: aioredis.Redis,
    db: asyncpg.Pool,
    stream_key: str,
    consumer_name: str,
) -> None:
    """Re-process messages that were delivered but not ACKed (from previous crash)."""
    logger.info("processing_pending_messages", stream=stream_key)
    try:
        messages = await redis.xreadgroup(
            groupname=CONSUMER_GROUP_NAME,
            consumername=consumer_name,
            streams={stream_key: "0"},
            count=100,
        )

        if not messages:
            logger.info("no_pending_messages")
            return

        count = 0
        for stream, entries in messages:
            for message_id, data in entries:
                if data:  # Empty data means already ACKed
                    await _process_message(redis, db, stream_key, message_id, data)
                    count += 1

        logger.info("pending_messages_processed", count=count)

    except Exception as exc:
        logger.error("pending_messages_error", error=str(exc))


async def _process_message(
    redis: aioredis.Redis,
    db: asyncpg.Pool,
    stream_key: str,
    message_id: str,
    data: dict,
) -> None:
    """Process a single stream message through the saga, then ACK."""
    reservation_id = data.get("reservation_id", "unknown")

    try:
        result = await execute_reservation_saga(redis, db, data)

        # ACK the message regardless of saga result (processed, skipped)
        await redis.xack(stream_key, CONSUMER_GROUP_NAME, message_id)
        logger.debug(
            "message_acked",
            message_id=message_id,
            reservation_id=reservation_id,
            saga_result=result,
        )

    except SagaCompensationError as exc:
        # Compensation failed — this is critical. ACK anyway to avoid infinite loop,
        # but log at ERROR level for manual investigation.
        await redis.xack(stream_key, CONSUMER_GROUP_NAME, message_id)
        logger.error(
            "saga_compensation_error_acked",
            message_id=message_id,
            reservation_id=reservation_id,
            error=str(exc),
        )

    except Exception as exc:
        # Don't ACK — message stays in pending for retry on next startup
        logger.error(
            "message_processing_failed_nack",
            message_id=message_id,
            reservation_id=reservation_id,
            error=str(exc),
        )
