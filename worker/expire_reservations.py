"""Background job — sweeps expired reservations every 30 seconds and returns stock.

Runs as a concurrent asyncio task alongside the stream consumer.
"""

import asyncio
import time

import redis.asyncio as aioredis
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from internal.constants import SWEEPER_INTERVAL
from internal.logging import get_logger
from worker.handlers.release_reservation import handle_release_reservation

logger = get_logger(__name__)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
    retry=retry_if_exception_type((aioredis.ConnectionError, OSError)),
    reraise=True,
)
async def _scan_and_release_expired(redis: aioredis.Redis) -> int:
    """Scan all reservation keys, find expired ones, release stock.

    Returns count of released reservations.
    """
    now = int(time.time())
    cursor = "0"
    released_count = 0

    while True:
        cursor, keys = await redis.scan(
            cursor=cursor,
            match="flash_sale:reservation:*",
            count=100,
        )

        for key in keys:
            reservation = await redis.hgetall(key)
            if not reservation:
                continue

            status = reservation.get("status", "")
            expires_at_str = reservation.get("expires_at", "0")

            # Only sweep reservations still in "reserved" state
            if status != "reserved":
                continue

            try:
                expires_at = int(expires_at_str)
            except (ValueError, TypeError):
                continue

            if expires_at >= now:
                continue

            # Extract IDs from the key and reservation data
            # Key format: flash_sale:reservation:{reservation_id}
            reservation_id = key.split(":")[-1]
            user_id = reservation.get("user_id", "")

            if not user_id:
                continue

            # Find product_id by scanning user lock keys
            product_id = await _find_product_id_for_user(redis, user_id)

            if product_id:
                result = await handle_release_reservation(
                    redis, product_id, user_id, reservation_id
                )
                if result == "RELEASED":
                    released_count += 1
                    logger.info(
                        "expired_reservation_released",
                        reservation_id=reservation_id,
                        user_id=user_id,
                        product_id=product_id,
                        expired_at=expires_at,
                    )
            else:
                # Fallback: can't find product_id, manually clean up
                logger.warning(
                    "expired_reservation_orphaned",
                    reservation_id=reservation_id,
                    user_id=user_id,
                )

        if cursor == "0":
            break

    return released_count


async def _find_product_id_for_user(redis: aioredis.Redis, user_id: str) -> str | None:
    """Find the product_id from a user's reservation lock key.

    Scans for keys matching flash_sale:user:*:{user_id}:reserved
    """
    cursor = "0"
    while True:
        cursor, keys = await redis.scan(
            cursor=cursor,
            match=f"flash_sale:user:*:{user_id}:reserved",
            count=50,
        )

        if keys:
            # Key format: flash_sale:user:{product_id}:{user_id}:reserved
            parts = keys[0].split(":")
            if len(parts) >= 4:
                return parts[2]

        if cursor == "0":
            break

    return None


async def run_expiry_sweeper(
    redis: aioredis.Redis,
    shutdown_event: asyncio.Event,
    interval: int = SWEEPER_INTERVAL,
) -> None:
    """Run the expiry sweeper loop. Stops when shutdown_event is set."""
    logger.info("expiry_sweeper_started", interval_seconds=interval)

    while not shutdown_event.is_set():
        try:
            released = await _scan_and_release_expired(redis)
            if released > 0:
                logger.info("sweep_cycle_complete", released=released)

        except asyncio.CancelledError:
            logger.info("expiry_sweeper_cancelled")
            break
        except Exception as exc:
            logger.error("sweeper_cycle_error", error=str(exc))

        # Wait for interval OR shutdown, whichever comes first
        try:
            await asyncio.wait_for(shutdown_event.wait(), timeout=interval)
            break  # shutdown_event was set
        except asyncio.TimeoutError:
            pass  # Interval elapsed, run another cycle

    logger.info("expiry_sweeper_shutdown_complete")
