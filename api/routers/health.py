"""Health and readiness check endpoints."""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

import asyncpg
import redis.asyncio as aioredis

from api.dependencies import get_redis, get_db
from api.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(
    redis: aioredis.Redis = Depends(get_redis),
    db: asyncpg.Pool = Depends(get_db),
):
    redis_status = "ok"
    postgres_status = "ok"

    try:
        await redis.ping()
    except Exception:
        redis_status = "error"

    try:
        async with db.acquire() as conn:
            await conn.fetchval("SELECT 1")
    except Exception:
        postgres_status = "error"

    overall = "ok" if redis_status == "ok" and postgres_status == "ok" else "degraded"
    return HealthResponse(status=overall, redis=redis_status, postgres=postgres_status)


@router.get("/ready")
async def ready(
    redis: aioredis.Redis = Depends(get_redis),
    db: asyncpg.Pool = Depends(get_db),
):
    """Readiness probe — returns 200 only when all dependencies are reachable."""
    try:
        await redis.ping()
    except Exception:
        return JSONResponse(status_code=503, content={"ready": False, "reason": "redis"})

    try:
        async with db.acquire() as conn:
            await conn.fetchval("SELECT 1")
    except Exception:
        return JSONResponse(status_code=503, content={"ready": False, "reason": "postgres"})

    return {"ready": True}
