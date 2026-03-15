"""FastAPI application factory with lifespan management."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from api.config import settings
from api.dependencies import init_redis, init_db, init_stripe, shutdown_pools
from api.middleware.rate_limit import limiter
from api.routers import health, inventory, waiting_room, reserve, payment, webhook, ws, demo, dashboard_ws
from api.services.reservation import init_scripts
from api.services.stock_broadcast import pubsub_listener
from api.services.dashboard_metrics import start_event_collector
from api.routers.dashboard_ws import start_dashboard_broadcast
from internal.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init pools, register Lua scripts, start pub/sub listener.
    Shutdown: close pools, cancel background tasks.
    """
    setup_logging(settings.log_level)

    redis = await init_redis()
    db = await init_db()
    init_stripe()
    await init_scripts(redis)

    # Start pub/sub → WebSocket bridge as background task
    pubsub_task = asyncio.create_task(pubsub_listener(redis))
    # Dashboard: event collector + metrics broadcast
    event_collector_task = asyncio.create_task(start_event_collector(redis))
    dashboard_task = asyncio.create_task(start_dashboard_broadcast(redis, db))

    yield

    pubsub_task.cancel()
    event_collector_task.cancel()
    dashboard_task.cancel()
    await shutdown_pools()


app = FastAPI(
    title="Midnight Product Drop",
    description="High-concurrency flash-sale system with atomic inventory control",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate Limiting ──
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Routers ──
app.include_router(health.router)
app.include_router(inventory.router)
app.include_router(waiting_room.router)
app.include_router(reserve.router)
app.include_router(payment.router)
app.include_router(webhook.router)
app.include_router(ws.router)
app.include_router(demo.router)
app.include_router(dashboard_ws.router)
