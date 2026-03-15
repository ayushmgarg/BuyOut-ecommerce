"""WebSocket endpoint for real-time stock updates."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from api.services.stock_broadcast import register_connection, unregister_connection
from internal.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/stock")
async def stock_websocket(
    websocket: WebSocket,
    product_id: str = Query(..., description="Product ID to subscribe to"),
):
    await websocket.accept()
    register_connection(product_id, websocket)
    logger.info("ws_connected", product_id=product_id)

    try:
        while True:
            # Keep connection alive — client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        unregister_connection(product_id, websocket)
        logger.info("ws_disconnected", product_id=product_id)
