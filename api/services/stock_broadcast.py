"""WebSocket stock broadcast via Redis Pub/Sub."""

import asyncio
import json
from collections import defaultdict

from fastapi import WebSocket

from internal.constants import STOCK_CHANNEL_KEY
from internal.logging import get_logger

logger = get_logger(__name__)

# Active WebSocket connections per product
_connections: dict[str, set[WebSocket]] = defaultdict(set)


def register_connection(product_id: str, ws: WebSocket) -> None:
    """Track a new WebSocket connection."""
    _connections[product_id].add(ws)


def unregister_connection(product_id: str, ws: WebSocket) -> None:
    """Remove a closed WebSocket connection."""
    _connections[product_id].discard(ws)
    if not _connections[product_id]:
        del _connections[product_id]


async def broadcast_to_product(product_id: str, message: str) -> None:
    """Send a message to all WebSocket clients watching a product."""
    dead = []
    for ws in _connections.get(product_id, set()):
        try:
            await ws.send_text(message)
        except Exception:
            dead.append(ws)

    for ws in dead:
        unregister_connection(product_id, ws)


async def pubsub_listener(redis) -> None:
    """Subscribe to all stock channels and fan out to WebSocket clients.

    Runs as a background task during app lifespan.
    """
    pubsub = redis.pubsub()
    await pubsub.psubscribe("flash_sale:stock_channel:*")
    logger.info("pubsub_listener_started")

    async for message in pubsub.listen():
        if message["type"] != "pmessage":
            continue

        try:
            channel = message["channel"]
            # Extract product_id from channel name
            product_id = channel.split(":")[-1]
            data = message["data"]
            await broadcast_to_product(product_id, data)
        except Exception as exc:
            logger.error("pubsub_broadcast_error", error=str(exc))
