"""Unit tests for idempotency key middleware."""

import pytest

from api.middleware.idempotency import check_idempotency, store_idempotency


@pytest.mark.asyncio
async def test_idempotency_miss(redis_client):
    """First call should return None."""
    result = await check_idempotency(redis_client, "key1")
    assert result is None


@pytest.mark.asyncio
async def test_idempotency_hit(redis_client):
    """Second call with same key should return cached response."""
    response = {"status": "reserved", "reservation_id": "res123"}
    await store_idempotency(redis_client, "key1", response)

    cached = await check_idempotency(redis_client, "key1")
    assert cached == response


@pytest.mark.asyncio
async def test_different_keys_independent(redis_client):
    """Different idempotency keys should be independent."""
    await store_idempotency(redis_client, "key1", {"a": 1})

    result = await check_idempotency(redis_client, "key2")
    assert result is None
