"""Shared test fixtures for unit and integration tests."""

import asyncio
import os

import pytest
import pytest_asyncio
import redis.asyncio as aioredis
import asyncpg
from httpx import ASGITransport, AsyncClient

from api.main import app
from api.dependencies import init_redis, init_db, shutdown_pools


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def redis_client():
    """Fresh Redis connection, flushed before each test."""
    url = os.getenv("REDIS_URL", "redis://localhost:6379/1")  # Use DB 1 for tests
    r = await aioredis.from_url(url, decode_responses=True)
    await r.flushdb()
    yield r
    await r.flushdb()
    await r.close()


@pytest_asyncio.fixture
async def db_pool():
    """Async PG pool for tests."""
    pool = await asyncpg.create_pool(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        user=os.getenv("POSTGRES_USER", "midnight"),
        password=os.getenv("POSTGRES_PASSWORD", "midnight_secret"),
        database=os.getenv("POSTGRES_DB", "midnight_drop"),
    )
    yield pool
    await pool.close()


@pytest_asyncio.fixture
async def client():
    """HTTPX async test client for FastAPI."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
