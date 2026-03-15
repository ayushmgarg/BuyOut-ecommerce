"""Reconciliation script — compares Redis inventory state against Postgres orders.

Verifies the invariant:
  original_stock == current_redis_stock + active_reservations + confirmed_orders + pending_orders

Exit code 0 = consistent, 1 = discrepancy detected.
"""

import argparse
import asyncio
import os
import sys

import asyncpg
import redis.asyncio as aioredis


async def get_redis_state(r: aioredis.Redis, product_id: str) -> dict:
    """Gather inventory and reservation counts from Redis."""
    inventory_key = f"flash_sale:product:{product_id}:inventory"
    current_stock = await r.get(inventory_key)
    current_stock = int(current_stock) if current_stock is not None else 0

    status_counts = {"reserved": 0, "confirmed": 0, "released": 0, "failed": 0}
    cursor = "0"

    while True:
        cursor, keys = await r.scan(
            cursor=cursor,
            match="flash_sale:reservation:*",
            count=200,
        )

        for key in keys:
            reservation = await r.hgetall(key)
            if not reservation:
                continue
            status = reservation.get("status", "unknown")
            if status in status_counts:
                status_counts[status] += 1

        if cursor == "0":
            break

    return {
        "current_stock": current_stock,
        **status_counts,
    }


async def get_postgres_state(conn: asyncpg.Connection, product_id: str) -> dict:
    """Gather product stock and order counts from Postgres."""
    product = await conn.fetchrow(
        "SELECT total_stock FROM products WHERE id = $1",
        product_id,
    )
    original_stock = product["total_stock"] if product else 0

    rows = await conn.fetch(
        "SELECT status, count(*)::int AS cnt FROM orders WHERE product_id = $1 GROUP BY status",
        product_id,
    )
    order_counts = {row["status"]: row["cnt"] for row in rows}

    return {
        "original_stock": original_stock,
        "confirmed_orders": order_counts.get("confirmed", 0),
        "pending_orders": order_counts.get("pending", 0),
        "failed_orders": order_counts.get("failed", 0),
    }


async def reconcile(product_id: str, redis_url: str, pg_config: dict) -> bool:
    """Compare Redis and Postgres state. Returns True if consistent."""
    r = await aioredis.from_url(redis_url, decode_responses=True)
    conn = await asyncpg.connect(**pg_config)

    try:
        redis_state = await get_redis_state(r, product_id)
        pg_state = await get_postgres_state(conn, product_id)
    finally:
        await r.close()
        await conn.close()

    redis_accounted = redis_state["current_stock"] + redis_state["reserved"]
    expected_stock = (
        pg_state["original_stock"]
        - pg_state["confirmed_orders"]
        - pg_state["pending_orders"]
    )

    print("=== Reconciliation Report ===")
    print(f"Product: {product_id}\n")
    print("Redis State:")
    print(f"  Current stock:          {redis_state['current_stock']}")
    print(f"  Active reservations:    {redis_state['reserved']}")
    print(f"  Confirmed reservations: {redis_state['confirmed']}")
    print(f"  Released reservations:  {redis_state['released']}")
    print(f"  Failed reservations:    {redis_state['failed']}")
    print(f"  Redis accounted:        {redis_accounted} (stock + active)\n")
    print("Postgres State:")
    print(f"  Original stock:    {pg_state['original_stock']}")
    print(f"  Confirmed orders:  {pg_state['confirmed_orders']}")
    print(f"  Pending orders:    {pg_state['pending_orders']}")
    print(f"  Failed orders:     {pg_state['failed_orders']}")
    print(f"  Expected stock:    {expected_stock} (original - confirmed - pending)\n")

    if expected_stock == redis_accounted:
        print("Verdict: CONSISTENT")
        return True
    else:
        drift = redis_accounted - expected_stock
        print("Verdict: DISCREPANCY DETECTED")
        print(f"  Expected stock: {expected_stock}")
        print(f"  Redis accounted: {redis_accounted}")
        print(f"  Drift: {drift:+d} units")
        return False


def main():
    parser = argparse.ArgumentParser(description="Reconcile Redis inventory with Postgres orders")
    parser.add_argument("--product-id", default="a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
    parser.add_argument("--redis-url", default=os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    parser.add_argument("--pg-host", default=os.getenv("POSTGRES_HOST", "localhost"))
    parser.add_argument("--pg-port", type=int, default=int(os.getenv("POSTGRES_PORT", "5432")))
    parser.add_argument("--pg-user", default=os.getenv("POSTGRES_USER", "midnight"))
    parser.add_argument("--pg-password", default=os.getenv("POSTGRES_PASSWORD", "midnight_secret"))
    parser.add_argument("--pg-database", default=os.getenv("POSTGRES_DB", "midnight_drop"))
    args = parser.parse_args()

    pg_config = {
        "host": args.pg_host,
        "port": args.pg_port,
        "user": args.pg_user,
        "password": args.pg_password,
        "database": args.pg_database,
    }

    consistent = asyncio.run(reconcile(args.product_id, args.redis_url, pg_config))
    sys.exit(0 if consistent else 1)


if __name__ == "__main__":
    main()
