"""Demo endpoint — launch bot users from the browser."""

import asyncio
import time
import uuid

import asyncpg
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

import redis.asyncio as aioredis

from api.config import settings
from api.dependencies import get_redis, get_db
from api.services.waiting_room import join_waiting_room, get_position, remove_from_waiting_room
from api.services.token import issue_token
from api.services.reservation import reserve_stock
from api.services.payment import get_payment_provider
from internal.constants import (
    RESERVATION_KEY,
    SALE_STARTS_AT_KEY,
    SALE_ACTIVE_KEY,
    INVENTORY_KEY,
)
from internal.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/demo", tags=["demo"])

# Track running simulation
_sim_lock = asyncio.Lock()
_sim_running = False
_sim_stats = {"total": 0, "purchased": 0, "sold_out": 0, "in_progress": 0}


class LaunchBotsRequest(BaseModel):
    num_bots: int = Field(default=30, ge=1, le=10000)
    stagger: float = Field(default=0.01, ge=0.001, le=5.0)


class LaunchBotsResponse(BaseModel):
    status: str
    num_bots: int
    message: str


async def _run_bot(redis: aioredis.Redis, product_id: str, user_id: str) -> str:
    """Run a single bot through the full purchase flow. Returns outcome."""
    # 1. Join waiting room
    position = await join_waiting_room(redis, product_id, user_id)
    logger.info("bot_joined", user_id=user_id, position=position)

    # 2. Get token (poll if needed)
    token = None
    if position < settings.waiting_room_batch_size:
        token = issue_token(user_id, product_id)
    else:
        for _ in range(400):
            await asyncio.sleep(0.3)
            pos = await get_position(redis, product_id, user_id)
            if pos is not None and pos < settings.waiting_room_batch_size:
                token = issue_token(user_id, product_id)
                break

    if not token:
        return "timeout"

    # 3. Reserve stock
    result = await reserve_stock(redis, product_id, user_id, quantity=1)
    if result["status"] == "out_of_stock":
        return "sold_out"
    if result["status"] != "reserved":
        return "error"

    reservation_id = result["reservation_id"]

    # 4. Simulate payment confirmation directly in Redis
    reservation_key = RESERVATION_KEY.format(reservation_id=reservation_id)
    await redis.hset(reservation_key, "status", "confirmed")
    await redis.incr(f"flash_sale:confirmed_count:{product_id}")

    logger.info("bot_purchased", user_id=user_id, reservation_id=reservation_id)
    return "purchased"


async def _run_simulation(redis: aioredis.Redis, product_id: str, num_bots: int, stagger: float) -> None:
    """Run the full bot simulation as a background task."""
    global _sim_running, _sim_stats

    _sim_stats = {"total": num_bots, "purchased": 0, "sold_out": 0, "in_progress": num_bots}

    async def bot_wrapper(user_id: str, delay: float) -> None:
        await asyncio.sleep(delay)
        try:
            outcome = await _run_bot(redis, product_id, user_id)
            if outcome == "purchased":
                _sim_stats["purchased"] += 1
            elif outcome == "sold_out":
                _sim_stats["sold_out"] += 1
        except Exception as e:
            logger.error("bot_error", user_id=user_id, error=str(e))
        finally:
            _sim_stats["in_progress"] -= 1

    tasks = []
    for i in range(num_bots):
        user_id = f"bot_{i:04d}"
        delay = i * stagger
        tasks.append(bot_wrapper(user_id, delay))

    await asyncio.gather(*tasks)
    _sim_running = False
    logger.info("simulation_complete", stats=_sim_stats)


@router.post("/launch-bots", response_model=LaunchBotsResponse)
async def launch_bots(
    body: LaunchBotsRequest,
    redis: aioredis.Redis = Depends(get_redis),
):
    global _sim_running

    async with _sim_lock:
        if _sim_running:
            return LaunchBotsResponse(
                status="already_running",
                num_bots=_sim_stats["total"],
                message=f"Simulation in progress: {_sim_stats['purchased']} purchased, {_sim_stats['in_progress']} remaining",
            )
        _sim_running = True

    product_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

    # Wait for sale to start before launching bots
    starts_at_key = SALE_STARTS_AT_KEY.format(product_id=product_id)
    starts_at = await redis.get(starts_at_key)

    async def wait_and_run() -> None:
        import time
        if starts_at:
            wait_time = float(starts_at) - time.time()
            if wait_time > 0:
                logger.info("bots_waiting_for_sale", wait_seconds=wait_time)
                await asyncio.sleep(wait_time)
        await _run_simulation(redis, product_id, body.num_bots, body.stagger)

    asyncio.create_task(wait_and_run())

    return LaunchBotsResponse(
        status="launched",
        num_bots=body.num_bots,
        message=f"{body.num_bots} bots queued — they'll join when the sale starts",
    )


@router.get("/bot-status")
async def bot_status():
    return {
        "running": _sim_running,
        **_sim_stats,
    }


# ── Chaos Generator ──

class LaunchChaosRequest(BaseModel):
    num_bots: int = Field(default=50000, ge=1, le=50000)
    stagger: float = Field(default=0.01, ge=0.001, le=1.0)


async def _chaos_bot(
    redis: aioredis.Redis,
    semaphore: asyncio.Semaphore,
    product_id: str,
    user_id: str,
) -> str:
    """Simplified chaos bot — join + reserve directly (skip token gating)."""
    async with semaphore:
        try:
            await join_waiting_room(redis, product_id, user_id)
            result = await reserve_stock(redis, product_id, user_id, quantity=1)
            if result["status"] == "out_of_stock":
                return "sold_out"
            if result["status"] == "reserved":
                reservation_key = RESERVATION_KEY.format(
                    reservation_id=result["reservation_id"]
                )
                await redis.hset(reservation_key, "status", "confirmed")
                await redis.incr(f"flash_sale:confirmed_count:{product_id}")
                return "purchased"
            return "error"
        except Exception:
            return "error"


async def _run_chaos(
    redis: aioredis.Redis,
    product_id: str,
    num_bots: int,
    stagger: float,
) -> None:
    """Run massive chaos simulation as a background task."""
    global _sim_running, _sim_stats

    _sim_stats = {
        "total": num_bots,
        "purchased": 0,
        "sold_out": 0,
        "in_progress": num_bots,
    }

    semaphore = asyncio.Semaphore(500)

    async def wrapper(user_id: str, delay: float) -> None:
        await asyncio.sleep(delay)
        outcome = await _chaos_bot(redis, semaphore, product_id, user_id)
        if outcome == "purchased":
            _sim_stats["purchased"] += 1
        elif outcome == "sold_out":
            _sim_stats["sold_out"] += 1
        _sim_stats["in_progress"] -= 1

    tasks = []
    for i in range(num_bots):
        delay = i * stagger
        tasks.append(wrapper(f"chaos_{i:06d}", delay))

    await asyncio.gather(*tasks)
    _sim_running = False
    logger.info("chaos_complete", stats=_sim_stats)


@router.post("/chaos")
async def launch_chaos(
    body: LaunchChaosRequest,
    redis: aioredis.Redis = Depends(get_redis),
):
    global _sim_running

    async with _sim_lock:
        if _sim_running:
            return {
                "status": "already_running",
                "num_bots": _sim_stats["total"],
                "message": f"In progress: {_sim_stats['purchased']} purchased, {_sim_stats['in_progress']} remaining",
            }
        _sim_running = True

    product_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
    asyncio.create_task(_run_chaos(redis, product_id, body.num_bots, body.stagger))

    return {
        "status": "launched",
        "num_bots": body.num_bots,
        "message": f"{body.num_bots:,} chaos bots unleashed!",
    }


# ── Reset Sale ──

class ResetRequest(BaseModel):
    countdown_seconds: int = Field(default=30, ge=5, le=300)
    stock: int = Field(default=1000, ge=1, le=10000)


@router.post("/reset")
async def reset_sale(
    body: ResetRequest = ResetRequest(),
    redis: aioredis.Redis = Depends(get_redis),
    db: asyncpg.Pool = Depends(get_db),
):
    """Reset all state: flush Redis, truncate Postgres, reload inventory, set countdown."""
    global _sim_running, _sim_stats

    from api.services.dashboard_metrics import clear_time_series
    clear_time_series()

    product_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

    # 1. Flush Redis
    await redis.flushall()

    # 2. Truncate Postgres
    async with db.acquire() as conn:
        await conn.execute("TRUNCATE order_events, orders CASCADE")
        await conn.execute("DELETE FROM idempotency_keys")

    # 3. Reload inventory
    await redis.set(INVENTORY_KEY.format(product_id=product_id), body.stock)
    await redis.set(SALE_ACTIVE_KEY.format(product_id=product_id), "1")

    # 4. Set sale start time
    starts_at = int(time.time()) + body.countdown_seconds
    await redis.set(SALE_STARTS_AT_KEY.format(product_id=product_id), str(starts_at))

    # 5. Reset simulation state
    _sim_running = False
    _sim_stats = {"total": 0, "purchased": 0, "sold_out": 0, "in_progress": 0}

    # 6. Re-register Lua scripts (flushed with FLUSHALL)
    from api.services.reservation import init_scripts
    await init_scripts(redis)

    logger.info("sale_reset", stock=body.stock, starts_at=starts_at)

    return {
        "status": "reset",
        "stock": body.stock,
        "starts_at": starts_at,
        "countdown_seconds": body.countdown_seconds,
    }
