"""Saga orchestrator — manages the multi-step reservation→order→payment→confirm flow.

Each saga step has a compensating action. If any step fails after a prior step
succeeded, the compensation chain runs in reverse order.
"""

import asyncpg
import redis.asyncio as aioredis
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from internal.constants import RESERVATION_KEY, STOCK_CHANNEL_KEY
from internal.logging import get_logger
from worker.handlers.confirm_order import handle_confirm_order
from worker.handlers.release_reservation import handle_release_reservation

logger = get_logger(__name__)


class SagaError(Exception):
    """Raised when a saga step fails after exhausting retries."""


class SagaCompensationError(Exception):
    """Raised when a compensation step itself fails."""


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
    retry=retry_if_exception_type((asyncpg.PostgresError, OSError, ConnectionError)),
    reraise=True,
)
async def _create_pending_order(db: asyncpg.Pool, message_data: dict) -> dict | None:
    """Step 1: Create a pending order record in PostgreSQL."""
    reservation_id = message_data.get("reservation_id", "")
    user_id = message_data.get("user_id", "")
    product_id = message_data.get("product_id", "")
    quantity = int(message_data.get("quantity", "1"))
    idempotency_key = f"order_{reservation_id}"

    async with db.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO orders (
                user_id, product_id, reservation_id, quantity,
                amount_cents, status, idempotency_key
            )
            VALUES ($1, $2, $3, $4, 0, 'pending', $5)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id, status
            """,
            user_id,
            product_id,
            reservation_id,
            quantity,
            idempotency_key,
        )

        if row is None:
            logger.info("saga_idempotent_skip", reservation_id=reservation_id)
            return None

        await conn.execute(
            """
            INSERT INTO order_events (order_id, event_type, payload)
            VALUES ($1, 'order_pending', $2::jsonb)
            """,
            row["id"],
            f'{{"reservation_id":"{reservation_id}"}}',
        )

        logger.info("saga_order_pending", order_id=str(row["id"]), reservation_id=reservation_id)
        return dict(row)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
    retry=retry_if_exception_type((asyncpg.PostgresError, OSError, ConnectionError)),
    reraise=True,
)
async def _confirm_order_in_db(
    db: asyncpg.Pool,
    reservation_id: str,
    amount_cents: int,
    payment_intent_id: str,
) -> None:
    """Step 3 (on webhook success): Finalize order status to 'confirmed'."""
    async with db.acquire() as conn:
        await conn.execute(
            """
            UPDATE orders
            SET status = 'confirmed',
                amount_cents = $2,
                stripe_payment_intent_id = $3,
                updated_at = now()
            WHERE reservation_id = $1 AND status = 'pending'
            """,
            reservation_id,
            amount_cents,
            payment_intent_id,
        )

        # Fetch order_id for audit
        order_id = await conn.fetchval(
            "SELECT id FROM orders WHERE reservation_id = $1",
            reservation_id,
        )
        if order_id:
            await conn.execute(
                """
                INSERT INTO order_events (order_id, event_type, payload)
                VALUES ($1, 'order_confirmed', $2::jsonb)
                """,
                order_id,
                f'{{"payment_intent":"{payment_intent_id}","amount_cents":{amount_cents}}}',
            )

    logger.info("saga_order_confirmed", reservation_id=reservation_id)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
    retry=retry_if_exception_type((asyncpg.PostgresError, OSError, ConnectionError)),
    reraise=True,
)
async def _fail_order_in_db(db: asyncpg.Pool, reservation_id: str, reason: str) -> None:
    """Compensation: Mark a pending order as failed."""
    async with db.acquire() as conn:
        await conn.execute(
            """
            UPDATE orders
            SET status = 'failed', updated_at = now()
            WHERE reservation_id = $1 AND status IN ('pending', 'confirmed')
            """,
            reservation_id,
        )

        order_id = await conn.fetchval(
            "SELECT id FROM orders WHERE reservation_id = $1",
            reservation_id,
        )
        if order_id:
            await conn.execute(
                """
                INSERT INTO order_events (order_id, event_type, payload)
                VALUES ($1, 'order_failed', $2::jsonb)
                """,
                order_id,
                f'{{"reason":"{reason}"}}',
            )

    logger.info("saga_order_failed", reservation_id=reservation_id, reason=reason)


async def execute_reservation_saga(
    redis: aioredis.Redis,
    db: asyncpg.Pool,
    message_data: dict,
) -> str:
    """Execute the full reservation saga.

    Steps:
      1. Create pending order in Postgres
      2. (Payment intent is created by the API, not the worker)
      3. Worker waits for webhook — this saga handles the "reserved" stream event

    Returns: "processed", "skipped" (idempotent), or "failed"
    """
    reservation_id = message_data.get("reservation_id", "")
    product_id = message_data.get("product_id", "")
    user_id = message_data.get("user_id", "")
    status = message_data.get("status", "")

    logger.info(
        "saga_started",
        reservation_id=reservation_id,
        status=status,
        user_id=user_id,
    )

    # ── Step 1: Create pending order ──
    if status == "reserved":
        try:
            order = await _create_pending_order(db, message_data)
            if order is None:
                return "skipped"
        except Exception as exc:
            logger.error(
                "saga_step1_failed",
                reservation_id=reservation_id,
                error=str(exc),
            )
            # No compensation needed — order was never created
            return "failed"

        logger.info("saga_step1_complete", reservation_id=reservation_id)
        return "processed"

    # ── Webhook-triggered: confirm order ──
    if status == "confirmed":
        try:
            amount_cents = int(message_data.get("amount_cents", "0"))
            payment_intent_id = message_data.get("payment_intent_id", "")

            await _confirm_order_in_db(db, reservation_id, amount_cents, payment_intent_id)

            # Mark reservation as confirmed in Redis
            reservation_key = RESERVATION_KEY.format(reservation_id=reservation_id)
            await redis.hset(reservation_key, "status", "confirmed")

            return "processed"

        except Exception as exc:
            logger.error(
                "saga_confirm_failed",
                reservation_id=reservation_id,
                error=str(exc),
            )
            return "failed"

    # ── Webhook-triggered: payment failed ──
    if status == "failed":
        try:
            reason = message_data.get("reason", "payment_failed")

            # Compensation: release stock
            await handle_release_reservation(
                redis, product_id, user_id, reservation_id
            )

            # Compensation: fail order in DB
            await _fail_order_in_db(db, reservation_id, reason)

            return "processed"

        except Exception as exc:
            logger.error(
                "saga_compensation_failed",
                reservation_id=reservation_id,
                error=str(exc),
            )
            raise SagaCompensationError(
                f"Compensation failed for {reservation_id}: {exc}"
            ) from exc

    logger.warning("saga_unknown_status", status=status, reservation_id=reservation_id)
    return "skipped"
