"""Handler: release an expired or failed reservation and return stock with retry logic."""

import redis.asyncio as aioredis
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from internal.constants import (
    INVENTORY_KEY,
    USER_RESERVED_KEY,
    RESERVATION_KEY,
    STOCK_CHANNEL_KEY,
)
from internal.redis_client import register_lua_script
from internal.logging import get_logger

logger = get_logger(__name__)

_release_script = None


async def init_release_script(redis: aioredis.Redis) -> None:
    """Register the release Lua script."""
    global _release_script
    _release_script = await register_lua_script(redis, "release")


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
    retry=retry_if_exception_type((aioredis.ConnectionError, OSError, ConnectionError)),
    reraise=True,
)
async def handle_release_reservation(
    redis: aioredis.Redis,
    product_id: str,
    user_id: str,
    reservation_id: str,
    quantity: int = 1,
) -> str:
    """Atomically release reservation and return stock.

    Retries up to 3 times with exponential backoff on Redis connection errors.
    Returns 'RELEASED' or 'ALREADY_RELEASED'.
    """
    if _release_script is None:
        raise RuntimeError("Release Lua script not initialized")

    inventory_key = INVENTORY_KEY.format(product_id=product_id)
    user_key = USER_RESERVED_KEY.format(product_id=product_id, user_id=user_id)
    reservation_key = RESERVATION_KEY.format(reservation_id=reservation_id)

    result = await _release_script(
        keys=[inventory_key, user_key, reservation_key],
        args=[str(quantity)],
    )

    if result == "RELEASED":
        current_stock = await redis.get(inventory_key)
        channel = STOCK_CHANNEL_KEY.format(product_id=product_id)
        await redis.publish(
            channel,
            f'{{"product_id":"{product_id}","stock":{current_stock},"event":"released"}}',
        )
        logger.info(
            "reservation_released",
            reservation_id=reservation_id,
            product_id=product_id,
            stock=current_stock,
        )

    return result
