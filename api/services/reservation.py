"""Reservation service — executes atomic Lua script for stock reservation."""

import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis

from api.config import settings
from internal.constants import (
    INVENTORY_KEY,
    RESERVATION_KEY,
    USER_RESERVED_KEY,
    ORDER_STREAM_KEY,
    STOCK_CHANNEL_KEY,
    SOLD_OUT_COUNTER_KEY,
    REQUEST_COUNTER_KEY,
)
from api.services.waiting_room import remove_from_waiting_room
from internal.redis_client import register_lua_script
from internal.logging import get_logger

logger = get_logger(__name__)

# Script handle — registered once at startup
_reserve_script = None
_release_script = None


async def init_scripts(redis: aioredis.Redis) -> None:
    """Register Lua scripts at startup. Must be called during lifespan."""
    global _reserve_script, _release_script
    _reserve_script = await register_lua_script(redis, "reserve")
    _release_script = await register_lua_script(redis, "release")


async def reserve_stock(
    redis: aioredis.Redis,
    product_id: str,
    user_id: str,
    quantity: int = 1,
) -> dict:
    """Execute atomic reservation via Lua script.

    Returns dict with 'status' and optionally 'reservation_id', 'expires_at'.
    """
    if _reserve_script is None:
        raise RuntimeError("Lua scripts not initialized")

    reservation_id = str(uuid.uuid4())
    ttl = settings.reservation_ttl_seconds
    expires_at = datetime.now(timezone.utc).timestamp() + ttl

    inventory_key = INVENTORY_KEY.format(product_id=product_id)
    user_key = USER_RESERVED_KEY.format(product_id=product_id, user_id=user_id)
    reservation_key = RESERVATION_KEY.format(reservation_id=reservation_id)

    result = await _reserve_script(
        keys=[inventory_key, user_key, reservation_key],
        args=[
            str(quantity),
            user_id,
            reservation_id,
            str(ttl),
            str(int(expires_at)),
            product_id,
        ],
    )

    if result == "USER_LIMIT_EXCEEDED":
        logger.info("user_limit_exceeded", user_id=user_id, product_id=product_id)
        return {"status": "user_limit_exceeded"}

    if result == "OUT_OF_STOCK":
        logger.info("out_of_stock", product_id=product_id)
        await redis.incr(SOLD_OUT_COUNTER_KEY.format(product_id=product_id))
        return {"status": "out_of_stock"}

    if isinstance(result, str) and result.startswith("RESERVED:"):
        # Push to order stream
        stream_key = ORDER_STREAM_KEY.format(product_id=product_id)
        await redis.xadd(
            stream_key,
            {
                "reservation_id": reservation_id,
                "user_id": user_id,
                "product_id": product_id,
                "quantity": str(quantity),
                "status": "reserved",
            },
        )

        # Remove from waiting room so positions shift for others
        await remove_from_waiting_room(redis, product_id, user_id)

        # Increment request counter for dashboard metrics
        await redis.incr(REQUEST_COUNTER_KEY.format(product_id=product_id))

        # Broadcast stock update (enriched with user_id for dashboard)
        current_stock = await redis.get(inventory_key)
        channel = STOCK_CHANNEL_KEY.format(product_id=product_id)
        await redis.publish(
            channel,
            f'{{"product_id":"{product_id}","stock":{current_stock},"event":"reserved","user_id":"{user_id}","reservation_id":"{reservation_id}"}}',
        )

        logger.info(
            "reserved",
            reservation_id=reservation_id,
            user_id=user_id,
            product_id=product_id,
            stock_remaining=current_stock,
        )

        return {
            "status": "reserved",
            "reservation_id": reservation_id,
            "expires_at": datetime.fromtimestamp(expires_at, tz=timezone.utc),
        }

    logger.error("unexpected_lua_result", result=result)
    return {"status": "error", "message": "Unexpected reservation result"}


async def release_stock(
    redis: aioredis.Redis,
    product_id: str,
    user_id: str,
    reservation_id: str,
    quantity: int = 1,
) -> str:
    """Release a reservation and return stock. Returns 'RELEASED' or 'ALREADY_RELEASED'."""
    if _release_script is None:
        raise RuntimeError("Lua scripts not initialized")

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
        logger.info("stock_released", reservation_id=reservation_id, product_id=product_id)

    return result
