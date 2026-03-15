"""Waiting room endpoints — join and check position."""

import time

from fastapi import APIRouter, Depends, HTTPException, Request, status

import redis.asyncio as aioredis

from api.config import settings
from api.dependencies import get_redis
from api.middleware.rate_limit import limiter
from api.models.schemas import (
    JoinWaitingRoomRequest,
    WaitingRoomPositionResponse,
)
from api.services.waiting_room import (
    join_waiting_room,
    get_position,
    get_waiting_room_size,
    get_total_joined,
)
from api.services.token import issue_token
from internal.constants import INVENTORY_KEY, SALE_STARTS_AT_KEY

router = APIRouter(tags=["waiting-room"])


@router.post("/join-waiting-room", response_model=WaitingRoomPositionResponse)
@limiter.limit(settings.rate_limit_waiting_room)
async def join(
    request: Request,
    body: JoinWaitingRoomRequest,
    redis: aioredis.Redis = Depends(get_redis),
):
    # Gate: reject requests before sale start time
    starts_at_key = SALE_STARTS_AT_KEY.format(product_id=body.product_id)
    starts_at = await redis.get(starts_at_key)
    if starts_at and time.time() < float(starts_at):
        raise HTTPException(
            status_code=status.HTTP_425_TOO_EARLY,
            detail="Sale has not started yet",
        )

    # Gate: reject if sold out
    stock = await redis.get(INVENTORY_KEY.format(product_id=body.product_id))
    if stock is not None and int(stock) <= 0:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Sold out",
        )

    position = await join_waiting_room(redis, body.product_id, body.user_id)
    total = await get_waiting_room_size(redis, body.product_id)
    total_joined = await get_total_joined(redis, body.product_id)

    # Estimate ~2 seconds per batch
    batches_ahead = position // settings.waiting_room_batch_size
    estimated_wait = batches_ahead * 2

    if position < settings.waiting_room_batch_size:
        token = issue_token(body.user_id, body.product_id)
        return WaitingRoomPositionResponse(
            status="ready",
            position=position,
            total=total,
            total_joined=total_joined,
            estimated_wait_seconds=0,
            token=token,
        )

    return WaitingRoomPositionResponse(
        status="waiting",
        position=position,
        total=total,
        total_joined=total_joined,
        estimated_wait_seconds=estimated_wait,
    )


@router.get("/waiting-room-status", response_model=WaitingRoomPositionResponse)
async def check_position(
    product_id: str,
    user_id: str,
    redis: aioredis.Redis = Depends(get_redis),
):
    position = await get_position(redis, product_id, user_id)
    total = await get_waiting_room_size(redis, product_id)
    total_joined = await get_total_joined(redis, product_id)

    # Check if sold out — notify waiting users
    stock = await redis.get(INVENTORY_KEY.format(product_id=product_id))
    if stock is not None and int(stock) <= 0:
        return WaitingRoomPositionResponse(
            status="sold_out",
            position=position,
            total=total,
            total_joined=total_joined,
            estimated_wait_seconds=None,
        )

    if position is None:
        return WaitingRoomPositionResponse(
            status="not_joined",
            position=None,
            total=total,
            total_joined=total_joined,
            estimated_wait_seconds=None,
        )

    if position < settings.waiting_room_batch_size:
        token = issue_token(user_id, product_id)
        return WaitingRoomPositionResponse(
            status="ready",
            position=position,
            total=total,
            total_joined=total_joined,
            estimated_wait_seconds=0,
            token=token,
        )

    batches_ahead = position // settings.waiting_room_batch_size
    return WaitingRoomPositionResponse(
        status="waiting",
        position=position,
        total=total,
        total_joined=total_joined,
        estimated_wait_seconds=batches_ahead * 2,
    )
