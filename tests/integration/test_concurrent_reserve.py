"""Integration test: concurrent reservation race condition test."""

import asyncio

import pytest

from internal.redis_client import register_lua_script


@pytest.mark.asyncio
async def test_concurrent_reservations_never_oversell(redis_client):
    """100 concurrent users trying to buy 10 items — exactly 10 should succeed."""
    product_id = "race_test"
    inventory_key = f"flash_sale:product:{product_id}:inventory"
    total_stock = 10
    total_users = 100

    await redis_client.set(inventory_key, total_stock)
    script = await register_lua_script(redis_client, "reserve")

    async def try_reserve(user_num: int) -> str:
        user_id = f"user_{user_num}"
        reservation_id = f"res_{user_num}"
        user_key = f"flash_sale:user:{product_id}:{user_id}:reserved"
        reservation_key = f"flash_sale:reservation:{reservation_id}"

        result = await script(
            keys=[inventory_key, user_key, reservation_key],
            args=["1", user_id, reservation_id, "120", "9999999999"],
        )
        return result

    results = await asyncio.gather(
        *[try_reserve(i) for i in range(total_users)]
    )

    reserved = [r for r in results if isinstance(r, str) and r.startswith("RESERVED:")]
    out_of_stock = [r for r in results if r == "OUT_OF_STOCK"]

    assert len(reserved) == total_stock
    assert len(out_of_stock) == total_users - total_stock

    # Inventory should be exactly 0
    final_stock = int(await redis_client.get(inventory_key))
    assert final_stock == 0
