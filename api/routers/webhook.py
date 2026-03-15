"""Stripe webhook endpoint — handles payment success/failure."""

import json

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status

import asyncpg
import redis.asyncio as aioredis

from api.config import settings
from api.dependencies import get_redis, get_db
from api.services.order import create_order
from api.services.reservation import release_stock
from internal.constants import RESERVATION_KEY
from internal.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/webhook", tags=["webhook"])


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    redis: aioredis.Redis = Depends(get_redis),
    db: asyncpg.Pool = Depends(get_db),
):
    body = await request.body()

    if settings.use_mock_payment:
        # In mock mode, accept raw JSON payloads
        event = json.loads(body)
    else:
        # Verify Stripe signature
        sig_header = request.headers.get("stripe-signature")
        try:
            event = stripe.Webhook.construct_event(
                body, sig_header, settings.stripe_webhook_secret
            )
        except stripe.error.SignatureVerificationError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid signature",
            )

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})
    metadata = data.get("metadata", {})

    reservation_id = metadata.get("reservation_id")
    product_id = metadata.get("product_id")
    user_id = metadata.get("user_id")

    # Look up missing fields from reservation hash in Redis
    if reservation_id and (not user_id or not product_id):
        reservation_key = RESERVATION_KEY.format(reservation_id=reservation_id)
        reservation_data = await redis.hgetall(reservation_key)
        if not user_id:
            user_id = reservation_data.get("user_id")
        if not product_id:
            product_id = reservation_data.get("product_id")

    if not reservation_id:
        logger.warning("webhook_missing_reservation_id", event_type=event_type)
        return {"status": "ignored"}

    if event_type == "payment_intent.succeeded":
        # Confirm reservation
        reservation_key = RESERVATION_KEY.format(reservation_id=reservation_id)
        await redis.hset(reservation_key, "status", "confirmed")

        # Persist order
        payment_intent_id = data.get("id", "")
        amount_cents = data.get("amount", 0)

        await create_order(
            db=db,
            user_id=user_id,
            product_id=product_id,
            reservation_id=reservation_id,
            quantity=1,
            amount_cents=amount_cents,
            stripe_payment_intent_id=payment_intent_id,
            idempotency_key=f"order_{reservation_id}",
        )

        logger.info("payment_succeeded", reservation_id=reservation_id)
        return {"status": "confirmed"}

    if event_type == "payment_intent.payment_failed":
        # Release stock
        await release_stock(redis, product_id, user_id, reservation_id, quantity=1)
        logger.info("payment_failed_stock_released", reservation_id=reservation_id)
        return {"status": "released"}

    logger.info("webhook_unhandled_event", event_type=event_type)
    return {"status": "ignored"}
