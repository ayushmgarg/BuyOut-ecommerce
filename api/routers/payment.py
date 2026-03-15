"""Payment endpoint — create Stripe PaymentIntent or mock equivalent."""

from fastapi import APIRouter, Depends, HTTPException, Request, status

import asyncpg
import redis.asyncio as aioredis

from api.config import settings
from api.dependencies import get_redis, get_db
from api.middleware.rate_limit import limiter
from api.models.schemas import CreatePaymentIntentRequest, CreatePaymentIntentResponse
from api.services.order import get_product_by_id
from api.services.payment import get_payment_provider
from internal.constants import RESERVATION_KEY

router = APIRouter(tags=["payment"])


@router.post("/create-payment-intent", response_model=CreatePaymentIntentResponse)
@limiter.limit(settings.rate_limit_payment)
async def create_payment_intent(
    request: Request,
    body: CreatePaymentIntentRequest,
    redis: aioredis.Redis = Depends(get_redis),
    db: asyncpg.Pool = Depends(get_db),
):
    # Verify reservation exists and is in reserved state
    reservation_key = RESERVATION_KEY.format(reservation_id=body.reservation_id)
    reservation = await redis.hgetall(reservation_key)

    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found or expired",
        )

    if reservation.get("status") != "reserved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Reservation status is '{reservation.get('status')}', expected 'reserved'",
        )

    # Get product price
    product = await get_product_by_id(db, body.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    provider = get_payment_provider()
    result = await provider.create_payment_intent(
        amount_cents=product["price_cents"],
        currency="usd",
        metadata={
            "reservation_id": body.reservation_id,
            "product_id": body.product_id,
            "user_id": reservation["user_id"],
        },
    )

    return CreatePaymentIntentResponse(**result)
