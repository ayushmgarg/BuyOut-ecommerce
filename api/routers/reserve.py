"""Reserve endpoint — atomic stock reservation via Lua script."""

from fastapi import APIRouter, Depends, HTTPException, Request, status

import redis.asyncio as aioredis

from api.config import settings
from api.dependencies import get_redis
from api.middleware.auth import require_reserve_token
from api.middleware.idempotency import check_idempotency, store_idempotency
from api.middleware.rate_limit import limiter
from api.models.schemas import ReserveRequest, ReserveResponse
from api.services.reservation import reserve_stock

router = APIRouter(tags=["reserve"])


@router.post("/reserve", response_model=ReserveResponse)
@limiter.limit(settings.rate_limit_reserve)
async def reserve(
    request: Request,
    body: ReserveRequest,
    token_payload: dict = Depends(require_reserve_token),
    redis: aioredis.Redis = Depends(get_redis),
):
    user_id = token_payload["sub"]
    product_id = token_payload["pid"]

    # Verify token matches requested product
    if product_id != body.product_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token product mismatch",
        )

    # Check idempotency
    cached = await check_idempotency(redis, body.idempotency_key)
    if cached:
        return ReserveResponse(**cached)

    result = await reserve_stock(redis, product_id, user_id, body.quantity)

    if result["status"] == "user_limit_exceeded":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a reservation",
        )

    if result["status"] == "out_of_stock":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Sold out",
        )

    if result["status"] == "reserved":
        response = ReserveResponse(
            status="reserved",
            reservation_id=result["reservation_id"],
            expires_at=result["expires_at"],
        )
        await store_idempotency(redis, body.idempotency_key, response.model_dump())
        return response

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Reservation failed unexpectedly",
    )
