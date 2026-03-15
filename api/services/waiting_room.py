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
    await redis.zadd(key, {user_id: timestamp}, nx=True)

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


async def remove_from_waiting_room(
    redis: aioredis.Redis, product_id: str, user_id: str
) -> None:
    """Remove user from waiting room after they get a token."""
    key = WAITING_ROOM_KEY.format(product_id=product_id)
    await redis.zrem(key, user_id)
