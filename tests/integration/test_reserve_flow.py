"""Integration test: full reservation flow end-to-end."""

import pytest

from internal.redis_client import register_lua_script


@pytest.mark.asyncio
async def test_full_reserve_and_release_flow(redis_client):
    """Reserve stock, then release it — stock should be restored."""
    product_id = "test_product"
    inventory_key = f"flash_sale:product:{product_id}:inventory"
    user_key = f"flash_sale:user:{product_id}:user1:reserved"
    reservation_key = "flash_sale:reservation:test_res_1"

    # Set initial stock
    await redis_client.set(inventory_key, 5)

    # Reserve
    reserve_script = await register_lua_script(redis_client, "reserve")
    result = await reserve_script(
        keys=[inventory_key, user_key, reservation_key],
        args=["1", "user1", "test_res_1", "120", "9999999999"],
    )
    assert result == "RESERVED:test_res_1"
    assert int(await redis_client.get(inventory_key)) == 4

    # Release
    release_script = await register_lua_script(redis_client, "release")
    result = await release_script(
        keys=[inventory_key, user_key, reservation_key],
        args=["1"],
    )
    assert result == "RELEASED"
    assert int(await redis_client.get(inventory_key)) == 5


@pytest.mark.asyncio
async def test_double_release_is_idempotent(redis_client):
    """Releasing the same reservation twice should return ALREADY_RELEASED."""
    inventory_key = "flash_sale:product:p1:inventory"
    user_key = "flash_sale:user:p1:u1:reserved"
    reservation_key = "flash_sale:reservation:r1"

    await redis_client.set(inventory_key, 10)

    reserve_script = await register_lua_script(redis_client, "reserve")
    await reserve_script(
        keys=[inventory_key, user_key, reservation_key],
        args=["1", "u1", "r1", "120", "9999999999"],
    )

    release_script = await register_lua_script(redis_client, "release")
    result1 = await release_script(keys=[inventory_key, user_key, reservation_key], args=["1"])
    assert result1 == "RELEASED"

    result2 = await release_script(keys=[inventory_key, user_key, reservation_key], args=["1"])
    assert result2 == "ALREADY_RELEASED"

    # Stock should only be incremented once
    assert int(await redis_client.get(inventory_key)) == 10
