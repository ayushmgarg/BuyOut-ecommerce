"""Worker entry point — runs consumer + sweeper with graceful shutdown.

Signal handlers (SIGTERM, SIGINT) trigger a shutdown event that drains
in-flight messages and closes connection pools cleanly.
"""

import asyncio
import os
import signal
import socket

from internal.constants import CONSUMER_NAME_PREFIX
from internal.db_client import create_db_pool
from internal.redis_client import create_redis_pool
from internal.logging import setup_logging, get_logger
from worker.consumer import consume_orders
from worker.expire_reservations import run_expiry_sweeper
from worker.handlers.release_reservation import init_release_script

logger = get_logger(__name__)

DEFAULT_PRODUCT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"


async def main():
    setup_logging(os.getenv("LOG_LEVEL", "INFO"))

    shutdown_event = asyncio.Event()

    # ── Signal Handlers ──
    loop = asyncio.get_running_loop()

    def _signal_handler(sig_name: str):
        logger.info("shutdown_signal_received", signal=sig_name)
        shutdown_event.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _signal_handler, sig.name)

    # ── Initialize Connections ──
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    redis = await create_redis_pool(redis_url)

    db = await create_db_pool(
        host=os.getenv("POSTGRES_HOST", "postgres"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        user=os.getenv("POSTGRES_USER", "midnight"),
        password=os.getenv("POSTGRES_PASSWORD", "midnight_secret"),
        database=os.getenv("POSTGRES_DB", "midnight_drop"),
    )

    # ── Register Lua Scripts ──
    await init_release_script(redis)

    product_id = os.getenv("PRODUCT_ID", DEFAULT_PRODUCT_ID)
    consumer_name = f"{CONSUMER_NAME_PREFIX}_{socket.gethostname()}"
    logger.info("worker_starting", product_id=product_id, consumer_name=consumer_name)

    # ── Run Consumer + Sweeper Concurrently ──
    try:
        await asyncio.gather(
            consume_orders(redis, db, product_id, shutdown_event, consumer_name=consumer_name),
            run_expiry_sweeper(redis, shutdown_event),
        )
    except Exception as exc:
        logger.error("worker_fatal_error", error=str(exc))
    finally:
        # ── Graceful Cleanup ──
        logger.info("worker_shutting_down")
        await redis.close()
        await db.close()
        logger.info("worker_shutdown_complete")


if __name__ == "__main__":
    asyncio.run(main())
