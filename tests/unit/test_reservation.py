"""Unit tests for reservation Lua script logic."""

import pytest

from internal.redis_client import register_lua_script


@pytest.mark.asyncio
async def test_reserve_stock_success(redis_client):
    """Happy path: reserve 1 unit from available stock."""
    await redis_client.set("flash_sale:product:test:inventory", 10)
    script = await register_lua_script(redis_client, "reserve")

    result = await script(
        keys=[
            "flash_sale:product:test:inventory",
            "flash_sale:user:test:user1:reserved",
            "flash_sale:reservation:res1",
        ],
        args=["1", "user1", "res1", "120", "9999999999"],
    )

    assert result.startswith("RESERVED:")
    stock = await redis_client.get("flash_sale:product:test:inventory")
    assert int(stock) == 9


@pytest.mark.asyncio
async def test_reserve_out_of_stock(redis_client):
    """Should return OUT_OF_STOCK when inventory is 0."""
    await redis_client.set("flash_sale:product:test:inventory", 0)
    script = await register_lua_script(redis_client, "reserve")

    result = await script(
        keys=[
            "flash_sale:product:test:inventory",
            "flash_sale:user:test:user1:reserved",
            "flash_sale:reservation:res1",
        ],
        args=["1", "user1", "res1", "120", "9999999999"],
    )

    assert result == "OUT_OF_STOCK"


@pytest.mark.asyncio
async def test_reserve_user_limit_exceeded(redis_client):
    """Should reject if user already has a reservation."""
    await redis_client.set("flash_sale:product:test:inventory", 10)
    await redis_client.set("flash_sale:user:test:user1:reserved", "reserved")
    script = await register_lua_script(redis_client, "reserve")

    result = await script(
        keys=[
            "flash_sale:product:test:inventory",
            "flash_sale:user:test:user1:reserved",
            "flash_sale:reservation:res1",
        ],
        args=["1", "user1", "res1", "120", "9999999999"],
    )

    assert result == "USER_LIMIT_EXCEEDED"
    stock = await redis_client.get("flash_sale:product:test:inventory")
    assert int(stock) == 10  # Stock unchanged
