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

# Time-series ring buffer for dashboard history
_time_series_buffer: deque = deque(maxlen=300)  # 5 min at 1/sec
_last_ts_record_time: float = 0.0

# Cached Postgres order count (queried at most every 5s)
_order_count_cache = {"value": 0, "updated_at": 0.0}
_order_count_lock = asyncio.Lock()

# Throughput tracking
_prev_request_count = 0
_prev_request_time = 0.0

# Peak queue depth (instantaneous ZCARD is often near-zero due to fast processing)
_peak_queue_depth = 0


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
    global _prev_request_count, _prev_request_time, _peak_queue_depth

    pipe = redis_conn.pipeline(transaction=False)
    pipe.get(INVENTORY_KEY.format(product_id=product_id))          # 0
    pipe.zcard(WAITING_ROOM_KEY.format(product_id=product_id))     # 1
    pipe.get(SOLD_OUT_COUNTER_KEY.format(product_id=product_id))   # 2
    pipe.get(REQUEST_COUNTER_KEY.format(product_id=product_id))    # 3
    pipe.get(f"flash_sale:total_joined:{product_id}")              # 4
    pipe.get(f"flash_sale:confirmed_count:{product_id}")           # 5

    results = await pipe.execute()

    stock = int(results[0]) if results[0] else 0
    queue_depth = results[1] or 0
    sold_out_count = int(results[2]) if results[2] else 0
    request_count = int(results[3]) if results[3] else 0
    total_joined = int(results[4]) if results[4] else 0
    confirmed_count = int(results[5]) if results[5] else 0

    # Track peak queue depth
    _peak_queue_depth = max(_peak_queue_depth, queue_depth)

    # Throughput calculation (clamped to 0 to prevent negatives after reset)
    now = time.time()
    if _prev_request_time > 0:
        elapsed = now - _prev_request_time
        delta = request_count - _prev_request_count
        throughput_rps = max(0.0, round(delta / max(elapsed, 0.001), 1))
    else:
        throughput_rps = 0.0
    _prev_request_count = request_count
    _prev_request_time = now

    # In-progress = joined users not yet confirmed or rejected
    in_progress = max(0, total_joined - confirmed_count - sold_out_count)

    # Worker simulation
    worker_count, worker_states = _compute_worker_states(in_progress)

    # Downsample into time-series buffer (at most once per second)
    global _last_ts_record_time
    if now - _last_ts_record_time >= 1.0:
        _time_series_buffer.append({
            "t": now,
            "stock": stock,
            "orders": confirmed_count,
            "queueDepth": queue_depth,
            "totalJoined": total_joined,
            "soldOut": sold_out_count,
            "throughput": throughput_rps,
            "activeReservations": in_progress,
        })
        _last_ts_record_time = now

    return {
        "stock": stock,
        "confirmed_orders": confirmed_count,
        "queue_depth": queue_depth,
        "total_joined": total_joined,
        "sold_out_count": sold_out_count,
        "active_reservations": in_progress,
        "throughput_rps": throughput_rps,
        "worker_count": worker_count,
        "worker_states": worker_states,
        "events": list(_events),
        "timestamp": now,
    }


def get_time_series_snapshot() -> list[dict]:
    """Return a copy of the time-series buffer for bootstrapping new dashboard connections."""
    return list(_time_series_buffer)


def clear_time_series():
    """Clear time-series buffer, events, and throughput state (called on sale reset)."""
    global _last_ts_record_time, _prev_request_count, _prev_request_time, _peak_queue_depth
    _time_series_buffer.clear()
    _events.clear()
    _last_ts_record_time = 0.0
    _prev_request_count = 0
    _prev_request_time = 0.0
    _peak_queue_depth = 0
    _order_count_cache["value"] = 0
    _order_count_cache["updated_at"] = 0.0


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
