"""Periodic sweeper — finds expired reservations and returns stock."""

import asyncio
import time

import redis.asyncio as aioredis

from internal.constants import RESERVATION_KEY, SWEEPER_INTERVAL
from internal.logging import get_logger
from worker.handlers.release_reservation import handle_release_reservation

logger = get_logger(__name__)


async def sweep_expired_reservations(
    redis: aioredis.Redis,
    interval: int = SWEEPER_INTERVAL,
) -> None:
    """Run every `interval` seconds: find expired reservations, release stock."""
    logger.info("expiry_sweeper_started", interval=interval)

    while True:
        try:
            now = int(time.time())
            cursor = "0"
            released_count = 0

            # SCAN for reservation keys
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
                    expires_at = reservation.get("expires_at", "0")

                    if status != "reserved":
                        continue

                    if int(expires_at) > now:
                        continue

                    # This reservation has expired — release it
                    reservation_id = key.split(":")[-1]
                    user_id = reservation.get("user_id", "")

                    # We need the product_id — scan for the user key to find it
                    # For simplicity, check user keys matching this user
                    user_cursor = "0"
                    product_id = None
                    while True:
                        user_cursor, user_keys = await redis.scan(
                            cursor=user_cursor,
                            match=f"flash_sale:user:*:{user_id}:reserved",
                            count=100,
                        )
                        if user_keys:
                            # Extract product_id from key pattern flash_sale:user:{pid}:{uid}:reserved
                            parts = user_keys[0].split(":")
                            product_id = parts[2]
                            break
                        if user_cursor == "0":
                            break

                    if product_id:
                        result = await handle_release_reservation(
                            redis, product_id, user_id, reservation_id
                        )
                        if result == "RELEASED":
                            released_count += 1

                if cursor == "0":
                    break

            if released_count > 0:
                logger.info("sweep_completed", released=released_count)

        except asyncio.CancelledError:
            logger.info("expiry_sweeper_cancelled")
            break
        except Exception as exc:
            logger.error("sweeper_error", error=str(exc))

        await asyncio.sleep(interval)
