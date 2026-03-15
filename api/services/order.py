"""Order persistence service — writes confirmed orders to PostgreSQL."""

import asyncpg

from internal.logging import get_logger

logger = get_logger(__name__)


async def create_order(
    db: asyncpg.Pool,
    user_id: str,
    product_id: str,
    reservation_id: str,
    quantity: int,
    amount_cents: int,
    stripe_payment_intent_id: str | None,
    idempotency_key: str,
) -> dict | None:
    """Insert a confirmed order. Returns the order row or None if idempotency key already exists."""
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO orders (
                user_id, product_id, reservation_id, quantity,
                amount_cents, status, stripe_payment_intent_id, idempotency_key
            )
            VALUES ($1, $2, $3, $4, $5, 'confirmed', $6, $7)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id, user_id, product_id, reservation_id, quantity,
                      amount_cents, status, created_at
            """,
            user_id,
            product_id,
            reservation_id,
            quantity,
            amount_cents,
            stripe_payment_intent_id,
            idempotency_key,
        )

        if row is None:
            logger.info("idempotent_order_skipped", idempotency_key=idempotency_key)
            return None

        # Record audit event
        await conn.execute(
            """
            INSERT INTO order_events (order_id, event_type, payload)
            VALUES ($1, 'order_confirmed', $2::jsonb)
            """,
            row["id"],
            f'{{"reservation_id":"{reservation_id}","payment_intent":"{stripe_payment_intent_id}"}}',
        )

        logger.info("order_created", order_id=str(row["id"]), user_id=user_id)
        return dict(row)


async def get_product_by_id(db: asyncpg.Pool, product_id: str) -> dict | None:
    """Fetch a product by ID."""
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, name, price_cents, total_stock, sale_starts_at FROM products WHERE id = $1",
            product_id,
        )
        return dict(row) if row else None
