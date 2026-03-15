"""Dashboard metrics aggregation — collects system state for the observer dashboard."""

import asyncio
import json
import time
from collections import deque

import asyncpg
import redis.asyncio as aioredis

from internal.constants import (
    INVENTORY_KEY,
    WAITING_ROOM_KEY,
    ORDER_STREAM_KEY,
    SOLD_OUT_COUNTER_KEY,
    REQUEST_COUNTER_KEY,
)
from internal.logging import get_logger

logger = get_logger(__name__)

PRODUCT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

# In-memory event log populated by pub/sub collector
_events: deque[dict] = deque(maxlen=50)

# Cached Postgres order count (queried at most every 5s)
_order_count_cache = {"value": 0, "updated_at": 0.0}
_order_count_lock = asyncio.Lock()

# Throughput tracking
_prev_request_count = 0
_prev_request_time = 0.0


async def _get_confirmed_order_count(db: asyncpg.Pool, product_id: str) -> int:
    """Get confirmed order count from Postgres, cached for 5 seconds."""
    now = time.time()
    if now - _order_count_cache["updated_at"] < 5.0:
        return _order_count_cache["value"]

    async with _order_count_lock:
        # Double-check after lock
        if time.time() - _order_count_cache["updated_at"] < 5.0:
            return _order_count_cache["value"]
        try:
            count = await db.fetchval(
                "SELECT count(*) FROM orders WHERE product_id = $1 AND status = 'confirmed'",
                product_id,
            )
            _order_count_cache["value"] = count or 0
            _order_count_cache["updated_at"] = time.time()
        except Exception as exc:
            logger.error("order_count_query_error", error=str(exc))
    return _order_count_cache["value"]


def _compute_worker_states(queue_depth: int) -> tuple[int, list[dict]]:
    """Compute simulated worker count and states based on queue depth."""
    worker_count = max(2, min(queue_depth // 10 + 2, 128))
    states = []
    for i in range(worker_count):
        if queue_depth == 0:
            state = "idle"
        elif i < queue_depth // 5:
            state = "processing"
        elif queue_depth > worker_count * 10:
            state = "overloaded"
        else:
            state = "processing" if i < worker_count // 2 else "idle"
        states.append({"id": f"worker_{i:03d}", "state": state})
    return worker_count, states


async def collect_metrics(
    redis_conn: aioredis.Redis,
    db: asyncpg.Pool,
    product_id: str,
) -> dict:
    """Collect all dashboard metrics in a single Redis pipeline + cached SQL."""
    global _prev_request_count, _prev_request_time

    pipe = redis_conn.pipeline(transaction=False)
    pipe.get(INVENTORY_KEY.format(product_id=product_id))
    pipe.zcard(WAITING_ROOM_KEY.format(product_id=product_id))
    pipe.get(SOLD_OUT_COUNTER_KEY.format(product_id=product_id))
    pipe.get(REQUEST_COUNTER_KEY.format(product_id=product_id))
    pipe.xlen(ORDER_STREAM_KEY.format(product_id=product_id))

    results = await pipe.execute()

    stock = int(results[0]) if results[0] else 0
    queue_depth = results[1] or 0
    sold_out_count = int(results[2]) if results[2] else 0
    request_count = int(results[3]) if results[3] else 0
    stream_length = results[4] or 0

    # Throughput calculation
    now = time.time()
    if _prev_request_time > 0:
        elapsed = now - _prev_request_time
        delta = request_count - _prev_request_count
        throughput_rps = round(delta / max(elapsed, 0.001), 1)
    else:
        throughput_rps = 0.0
    _prev_request_count = request_count
    _prev_request_time = now

    # Confirmed orders (cached SQL)
    confirmed_orders = await _get_confirmed_order_count(db, product_id)

    # Worker simulation
    worker_count, worker_states = _compute_worker_states(queue_depth)

    return {
        "stock": stock,
        "confirmed_orders": confirmed_orders,
        "queue_depth": queue_depth,
        "sold_out_count": sold_out_count,
        "active_reservations": stream_length,
        "throughput_rps": throughput_rps,
        "worker_count": worker_count,
        "worker_states": worker_states,
        "events": list(_events),
        "timestamp": now,
    }


async def start_event_collector(redis_conn: aioredis.Redis) -> None:
    """Subscribe to stock channel pub/sub and populate the events deque.

    Runs as a background task during app lifespan.
    """
    pubsub = redis_conn.pubsub()
    await pubsub.psubscribe("flash_sale:stock_channel:*")
    logger.info("dashboard_event_collector_started")

    async for message in pubsub.listen():
        if message["type"] != "pmessage":
            continue
        try:
            data = json.loads(message["data"])
            _events.append({
                "type": data.get("event", "unknown"),
                "user_id": data.get("user_id", ""),
                "reservation_id": data.get("reservation_id", ""),
                "timestamp": time.time(),
                "status": "success" if data.get("event") != "released" else "compensated",
            })
        except Exception:
            pass
