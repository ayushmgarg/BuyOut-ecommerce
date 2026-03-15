"""Handler: persist a confirmed order to PostgreSQL with retry logic."""

import asyncpg
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from internal.logging import get_logger

logger = get_logger(__name__)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
    retry=retry_if_exception_type((asyncpg.PostgresError, OSError, ConnectionError)),
    reraise=True,
)
async def handle_confirm_order(
    db: asyncpg.Pool, message_data: dict
) -> bool:
    """Persist a confirmed order from a stream message.

    Retries up to 3 times with exponential backoff on database errors.
    Returns True if order was created, False if idempotent skip.
    """
    reservation_id = message_data.get("reservation_id", "")
    user_id = message_data.get("user_id", "")
    product_id = message_data.get("product_id", "")
    quantity = int(message_data.get("quantity", "1"))
    amount_cents = int(message_data.get("amount_cents", "0"))
    payment_intent_id = message_data.get("payment_intent_id", "")
    idempotency_key = f"order_{reservation_id}"

    async with db.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO orders (
                user_id, product_id, reservation_id, quantity,
                amount_cents, status, stripe_payment_intent_id, idempotency_key
            )
            VALUES ($1, $2, $3, $4, $5, 'confirmed', $6, $7)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id
            """,
            user_id,
            product_id,
            reservation_id,
            quantity,
            amount_cents,
            payment_intent_id,
            idempotency_key,
        )

        if row is None:
            logger.info("idempotent_skip", idempotency_key=idempotency_key)
            return False

        await conn.execute(
            """
            INSERT INTO order_events (order_id, event_type, payload)
            VALUES ($1, 'order_confirmed', $2::jsonb)
            """,
            row["id"],
            f'{{"reservation_id":"{reservation_id}"}}',
        )

        logger.info("order_persisted", order_id=str(row["id"]))
        return True
