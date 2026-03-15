"""Integration test: expired reservations should be swept and stock returned."""

import time

import pytest

from internal.redis_client import register_lua_script


@pytest.mark.asyncio
async def test_expired_reservation_detected(redis_client):
    """Create a reservation with past expiry — sweeper logic should detect it."""
    product_id = "sweep_test"
    inventory_key = f"flash_sale:product:{product_id}:inventory"

    await redis_client.set(inventory_key, 10)

    script = await register_lua_script(redis_client, "reserve")

    # Reserve with an already-expired timestamp
    past_ts = str(int(time.time()) - 60)
    result = await script(
        keys=[
            inventory_key,
            f"flash_sale:user:{product_id}:user1:reserved",
            "flash_sale:reservation:expired_res_1",
        ],
        args=["1", "user1", "expired_res_1", "120", past_ts],
    )
    assert result == "RESERVED:expired_res_1"
    assert int(await redis_client.get(inventory_key)) == 9

    # Verify the reservation has expires_at in the past
    reservation = await redis_client.hgetall("flash_sale:reservation:expired_res_1")
    assert int(reservation["expires_at"]) < int(time.time())
