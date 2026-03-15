"""Dashboard WebSocket — broadcasts aggregated metrics every 500ms."""

import asyncio
import json

import asyncpg
import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.services.dashboard_metrics import collect_metrics, PRODUCT_ID
from internal.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["dashboard"])

_dashboard_connections: set[WebSocket] = set()


@router.websocket("/ws/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    await websocket.accept()
    _dashboard_connections.add(websocket)
    logger.info("dashboard_ws_connected", total=len(_dashboard_connections))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _dashboard_connections.discard(websocket)


async def start_dashboard_broadcast(
    redis_conn: aioredis.Redis,
    db: asyncpg.Pool,
) -> None:
    """Background task: collect metrics and broadcast to all dashboard clients every 500ms."""
    logger.info("dashboard_broadcast_started")
    while True:
        try:
            if _dashboard_connections:
                metrics = await collect_metrics(redis_conn, db, PRODUCT_ID)
                payload = json.dumps(metrics, default=str)

                dead = []
                for ws in _dashboard_connections:
                    try:
                        await ws.send_text(payload)
                    except Exception:
                        dead.append(ws)

                for ws in dead:
                    _dashboard_connections.discard(ws)

            await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("dashboard_broadcast_error", error=str(exc))
            await asyncio.sleep(1)
