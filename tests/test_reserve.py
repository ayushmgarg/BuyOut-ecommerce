"""Tests for the /reserve HTTP endpoint."""

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from api.main import app
from api.dependencies import get_redis
from api.services.token import issue_token
from api.services.reservation import init_scripts


PRODUCT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"


@pytest_asyncio.fixture
async def seeded_redis(redis_client):
    """Redis with inventory loaded and Lua scripts registered."""
    await redis_client.set(f"flash_sale:product:{PRODUCT_ID}:inventory", 10)
    await redis_client.set(f"flash_sale:product:{PRODUCT_ID}:sale_active", "1")
    await init_scripts(redis_client)
    return redis_client


@pytest_asyncio.fixture
async def test_client(seeded_redis):
    """HTTPX client with Redis dependency overridden to test instance."""
    app.dependency_overrides[get_redis] = lambda: seeded_redis

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


def _make_token(user_id: str = "test_user", product_id: str = PRODUCT_ID) -> str:
    """Generate a valid reserve token."""
    return issue_token(user_id, product_id)


@pytest.mark.asyncio
async def test_reserve_with_valid_token(test_client, seeded_redis):
    """Happy path: reserve 1 unit with a valid token."""
    token = _make_token()
    resp = await test_client.post(
        "/reserve",
        json={
            "product_id": PRODUCT_ID,
            "quantity": 1,
            "idempotency_key": str(uuid.uuid4()),
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "reserved"
    assert data["reservation_id"] is not None
    assert data["expires_at"] is not None

    # Verify stock decremented
    stock = await seeded_redis.get(f"flash_sale:product:{PRODUCT_ID}:inventory")
    assert int(stock) == 9


@pytest.mark.asyncio
async def test_reserve_without_token(test_client):
    """Request without Authorization header returns 403."""
    resp = await test_client.post(
        "/reserve",
        json={
            "product_id": PRODUCT_ID,
            "quantity": 1,
            "idempotency_key": str(uuid.uuid4()),
        },
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_reserve_out_of_stock(test_client, seeded_redis):
    """Reserve when inventory is 0 returns 410 Gone."""
    await seeded_redis.set(f"flash_sale:product:{PRODUCT_ID}:inventory", 0)
    token = _make_token()

    resp = await test_client.post(
        "/reserve",
        json={
            "product_id": PRODUCT_ID,
            "quantity": 1,
            "idempotency_key": str(uuid.uuid4()),
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 410
    assert "Sold out" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_reserve_user_limit_exceeded(test_client, seeded_redis):
    """Second reservation by same user returns 409 Conflict."""
    # First reservation succeeds
    token1 = _make_token(user_id="greedy_user")
    resp1 = await test_client.post(
        "/reserve",
        json={
            "product_id": PRODUCT_ID,
            "quantity": 1,
            "idempotency_key": str(uuid.uuid4()),
        },
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert resp1.status_code == 200

    # Second reservation by same user (new token, different idempotency key)
    token2 = _make_token(user_id="greedy_user")
    resp2 = await test_client.post(
        "/reserve",
        json={
            "product_id": PRODUCT_ID,
            "quantity": 1,
            "idempotency_key": str(uuid.uuid4()),
        },
        headers={"Authorization": f"Bearer {token2}"},
    )

    assert resp2.status_code == 409
    assert "already have a reservation" in resp2.json()["detail"]


@pytest.mark.asyncio
async def test_reserve_with_expired_token(test_client):
    """Expired JWT returns 401."""
    import jwt as pyjwt
    from api.config import settings

    payload = {
        "sub": "test_user",
        "pid": PRODUCT_ID,
        "scope": "reserve",
        "jti": str(uuid.uuid4()),
        "exp": 0,  # Expired at epoch
    }
    expired_token = pyjwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    resp = await test_client.post(
        "/reserve",
        json={
            "product_id": PRODUCT_ID,
            "quantity": 1,
            "idempotency_key": str(uuid.uuid4()),
        },
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert resp.status_code == 401
    assert "expired" in resp.json()["detail"].lower()
