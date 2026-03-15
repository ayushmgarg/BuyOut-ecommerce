"""Idempotency key middleware — checks Redis for cached responses."""

import json

import redis.asyncio as aioredis

from internal.constants import IDEMPOTENCY_KEY, DEFAULT_IDEMPOTENCY_TTL


async def check_idempotency(
    redis: aioredis.Redis, key: str
) -> dict | None:
    """Check if an idempotency key has a cached response. Returns cached response or None."""
    redis_key = IDEMPOTENCY_KEY.format(key=key)
    cached = await redis.get(redis_key)
    if cached:
        return json.loads(cached)
    return None


async def store_idempotency(
    redis: aioredis.Redis, key: str, response: dict, ttl: int = DEFAULT_IDEMPOTENCY_TTL
) -> None:
    """Cache a response under an idempotency key."""
    redis_key = IDEMPOTENCY_KEY.format(key=key)
    await redis.set(redis_key, json.dumps(response, default=str), ex=ttl)
