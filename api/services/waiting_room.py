"""Waiting room management using Redis Sorted Sets."""

import time

import redis.asyncio as aioredis

from internal.constants import WAITING_ROOM_KEY


async def join_waiting_room(
    redis: aioredis.Redis, product_id: str, user_id: str
) -> int:
    """Add user to waiting room ZSET. Returns their position (0-indexed)."""
    key = WAITING_ROOM_KEY.format(product_id=product_id)
    timestamp = time.time()

    # ZADD NX — only add if not already present
    added = await redis.zadd(key, {user_id: timestamp}, nx=True)

    # Track cumulative users for dashboard (only increment on new join)
    if added:
        await redis.incr(f"flash_sale:total_joined:{product_id}")

    position = await redis.zrank(key, user_id)
    return position if position is not None else 0


async def get_position(
    redis: aioredis.Redis, product_id: str, user_id: str
) -> int | None:
    """Get user's current position in the waiting room. None if not joined."""
    key = WAITING_ROOM_KEY.format(product_id=product_id)
    return await redis.zrank(key, user_id)


async def get_waiting_room_size(
    redis: aioredis.Redis, product_id: str
) -> int:
    """Total number of users in the waiting room."""
    key = WAITING_ROOM_KEY.format(product_id=product_id)
    return await redis.zcard(key)


async def get_total_joined(
    redis: aioredis.Redis, product_id: str
) -> int:
    """Cumulative count of all users who have ever joined the waiting room."""
    val = await redis.get(f"flash_sale:total_joined:{product_id}")
    return int(val) if val else 0


async def remove_from_waiting_room(
    redis: aioredis.Redis, product_id: str, user_id: str
) -> None:
    """Remove user from waiting room after they get a token."""
    key = WAITING_ROOM_KEY.format(product_id=product_id)
    await redis.zrem(key, user_id)
