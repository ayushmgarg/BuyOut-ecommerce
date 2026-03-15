"""FastAPI dependency injection — Redis pool, DB pool, Stripe client."""

from functools import lru_cache
from typing import AsyncGenerator

import asyncpg
import redis.asyncio as aioredis
import stripe

from api.config import settings
from internal.db_client import create_db_pool
from internal.redis_client import create_redis_pool

# Module-level state (set during app lifespan)
_redis_pool: aioredis.Redis | None = None
_db_pool: asyncpg.Pool | None = None


async def init_redis() -> aioredis.Redis:
    """Initialize Redis pool (called during app lifespan startup)."""
    global _redis_pool
    _redis_pool = await create_redis_pool(settings.redis_url)
    return _redis_pool


async def init_db() -> asyncpg.Pool:
    """Initialize DB pool (called during app lifespan startup)."""
    global _db_pool
    _db_pool = await create_db_pool(
        host=settings.postgres_host,
        port=settings.postgres_port,
        user=settings.postgres_user,
        password=settings.postgres_password,
        database=settings.postgres_db,
    )
    return _db_pool


def init_stripe() -> None:
    """Configure Stripe SDK if keys are available."""
    if not settings.use_mock_payment:
        stripe.api_key = settings.stripe_secret_key


async def shutdown_pools() -> None:
    """Gracefully close pools on shutdown."""
    global _redis_pool, _db_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None
    if _db_pool:
        await _db_pool.close()
        _db_pool = None


async def get_redis() -> aioredis.Redis:
    """Dependency: get Redis connection."""
    if _redis_pool is None:
        raise RuntimeError("Redis pool not initialized")
    return _redis_pool


async def get_db() -> asyncpg.Pool:
    """Dependency: get DB pool."""
    if _db_pool is None:
        raise RuntimeError("DB pool not initialized")
    return _db_pool


@lru_cache
def get_settings():
    """Dependency: get cached settings."""
    return settings
