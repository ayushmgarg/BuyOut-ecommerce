"""Tests for the saga orchestrator (worker/saga.py)."""

import uuid

import pytest
import pytest_asyncio

from worker.saga import execute_reservation_saga
from worker.handlers.release_reservation import init_release_script
from internal.redis_client import register_lua_script


PRODUCT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"


@pytest_asyncio.fixture
async def seeded_db(db_pool):
    """Ensure test product exists and orders table is clean."""
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO products (id, name, price_cents, total_stock, sale_starts_at)
            VALUES ($1, 'Test Product', 14999, 100, now())
            ON CONFLICT (id) DO NOTHING
            """,
            PRODUCT_ID,
        )
        await conn.execute("DELETE FROM order_events")
        await conn.execute("DELETE FROM orders WHERE product_id = $1", PRODUCT_ID)
    return db_pool


@pytest_asyncio.fixture
async def saga_redis(redis_client):
    """Redis with inventory and Lua scripts for saga tests."""
    await redis_client.set(f"flash_sale:product:{PRODUCT_ID}:inventory", 10)
    await init_release_script(redis_client)
    await register_lua_script(redis_client, "reserve")
    return redis_client


def _make_message(
    reservation_id: str | None = None,
    user_id: str = "saga_user",
    status: str = "reserved",
    **extra,
) -> dict:
    """Build a stream message dict for the saga."""
    return {
        "reservation_id": reservation_id or str(uuid.uuid4()),
        "user_id": user_id,
        "product_id": PRODUCT_ID,
        "quantity": "1",
        "status": status,
        **extra,
    }


@pytest.mark.asyncio
async def test_saga_reserved_creates_pending_order(saga_redis, seeded_db):
    """Status 'reserved' should create a pending order in Postgres."""
    rid = str(uuid.uuid4())
    msg = _make_message(reservation_id=rid)

    result = await execute_reservation_saga(saga_redis, seeded_db, msg)

    assert result == "processed"

    async with seeded_db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT status FROM orders WHERE reservation_id = $1",
            rid,
        )
        assert row is not None
        assert row["status"] == "pending"

        event = await conn.fetchrow(
            """
            SELECT event_type FROM order_events
            WHERE order_id = (SELECT id FROM orders WHERE reservation_id = $1)
            """,
            rid,
        )
        assert event["event_type"] == "order_pending"


@pytest.mark.asyncio
async def test_saga_confirmed_finalizes_order(saga_redis, seeded_db):
    """Status 'confirmed' should update order to confirmed and mark Redis reservation."""
    rid = str(uuid.uuid4())

    # First create a pending order
    msg_reserved = _make_message(reservation_id=rid, status="reserved")
    await execute_reservation_saga(saga_redis, seeded_db, msg_reserved)

    # Create reservation hash in Redis (simulating what the reserve Lua script does)
    reservation_key = f"flash_sale:reservation:{rid}"
    await saga_redis.hset(reservation_key, mapping={"status": "reserved", "user_id": "saga_user"})

    # Now confirm it
    msg_confirmed = _make_message(
        reservation_id=rid,
        status="confirmed",
        amount_cents="14999",
        payment_intent_id="pi_test_123",
    )
    result = await execute_reservation_saga(saga_redis, seeded_db, msg_confirmed)

    assert result == "processed"

    # Verify Postgres
    async with seeded_db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT status, amount_cents, stripe_payment_intent_id FROM orders WHERE reservation_id = $1",
            rid,
        )
        assert row["status"] == "confirmed"
        assert row["amount_cents"] == 14999
        assert row["stripe_payment_intent_id"] == "pi_test_123"

    # Verify Redis reservation status
    redis_status = await saga_redis.hget(reservation_key, "status")
    assert redis_status == "confirmed"


@pytest.mark.asyncio
async def test_saga_failed_releases_stock(saga_redis, seeded_db):
    """Status 'failed' should release stock back and mark order as failed."""
    rid = str(uuid.uuid4())
    user_id = "fail_user"

    # Create a pending order first
    msg_reserved = _make_message(reservation_id=rid, user_id=user_id, status="reserved")
    await execute_reservation_saga(saga_redis, seeded_db, msg_reserved)

    # Simulate reservation state in Redis (as if reserve Lua script ran)
    inventory_key = f"flash_sale:product:{PRODUCT_ID}:inventory"
    user_key = f"flash_sale:user:{PRODUCT_ID}:{user_id}:reserved"
    reservation_key = f"flash_sale:reservation:{rid}"

    await saga_redis.set(inventory_key, 9)  # 1 unit was reserved
    await saga_redis.set(user_key, "reserved")
    await saga_redis.hset(reservation_key, mapping={
        "status": "reserved",
        "user_id": user_id,
        "expires_at": "9999999999",
    })

    # Now send failure
    msg_failed = _make_message(
        reservation_id=rid,
        user_id=user_id,
        status="failed",
        reason="card_declined",
    )
    result = await execute_reservation_saga(saga_redis, seeded_db, msg_failed)

    assert result == "processed"

    # Stock should be restored
    stock = await saga_redis.get(inventory_key)
    assert int(stock) == 10

    # User lock should be cleared
    user_lock = await saga_redis.get(user_key)
    assert user_lock is None

    # Reservation status should be released
    res_status = await saga_redis.hget(reservation_key, "status")
    assert res_status == "released"

    # Postgres order should be failed
    async with seeded_db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT status FROM orders WHERE reservation_id = $1",
            rid,
        )
        assert row["status"] == "failed"


@pytest.mark.asyncio
async def test_saga_idempotent_skip(saga_redis, seeded_db):
    """Processing the same reservation_id twice should skip on the second call."""
    rid = str(uuid.uuid4())
    msg = _make_message(reservation_id=rid)

    result1 = await execute_reservation_saga(saga_redis, seeded_db, msg)
    result2 = await execute_reservation_saga(saga_redis, seeded_db, msg)

    assert result1 == "processed"
    assert result2 == "skipped"

    # Only one order row should exist
    async with seeded_db.acquire() as conn:
        count = await conn.fetchval(
            "SELECT count(*) FROM orders WHERE reservation_id = $1",
            rid,
        )
        assert count == 1


@pytest.mark.asyncio
async def test_saga_unknown_status_skipped(saga_redis, seeded_db):
    """Unknown status should be skipped without error."""
    msg = _make_message(status="banana")

    result = await execute_reservation_saga(saga_redis, seeded_db, msg)

    assert result == "skipped"
