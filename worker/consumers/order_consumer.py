"""Redis Streams consumer — reads confirmed orders and persists to Postgres."""

import asyncio

import asyncpg
import redis.asyncio as aioredis

from internal.constants import ORDER_STREAM_KEY, CONSUMER_GROUP_NAME, CONSUMER_NAME_PREFIX
from internal.logging import get_logger
from worker.handlers.confirm_order import handle_confirm_order

logger = get_logger(__name__)


async def ensure_consumer_group(redis: aioredis.Redis, stream_key: str) -> None:
    """Create consumer group if it doesn't exist."""
    try:
        await redis.xgroup_create(stream_key, CONSUMER_GROUP_NAME, id="0", mkstream=True)
        logger.info("consumer_group_created", stream=stream_key, group=CONSUMER_GROUP_NAME)
    except aioredis.ResponseError as e:
        if "BUSYGROUP" in str(e):
            pass  # Group already exists
        else:
            raise


async def consume_orders(
    redis: aioredis.Redis,
    db: asyncpg.Pool,
    product_id: str,
    consumer_name: str = f"{CONSUMER_NAME_PREFIX}_1",
) -> None:
    """Continuously read from order stream and process messages."""
    stream_key = ORDER_STREAM_KEY.format(product_id=product_id)
    await ensure_consumer_group(redis, stream_key)

    logger.info("order_consumer_started", stream=stream_key, consumer=consumer_name)

    while True:
        try:
            messages = await redis.xreadgroup(
                groupname=CONSUMER_GROUP_NAME,
                consumername=consumer_name,
                streams={stream_key: ">"},
                count=10,
                block=5000,
            )

            if not messages:
                continue

            for stream, entries in messages:
                for message_id, data in entries:
                    try:
                        status = data.get("status", "")
                        if status == "confirmed":
                            await handle_confirm_order(db, data)

                        await redis.xack(stream_key, CONSUMER_GROUP_NAME, message_id)
                        logger.debug("message_acked", message_id=message_id)

                    except Exception as exc:
                        logger.error(
                            "message_processing_error",
                            message_id=message_id,
                            error=str(exc),
                        )

        except asyncio.CancelledError:
            logger.info("order_consumer_cancelled")
            break
        except Exception as exc:
            logger.error("consumer_loop_error", error=str(exc))
            await asyncio.sleep(1)
