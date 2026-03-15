"""Pre-sale script — loads inventory into Redis and activates sale."""

import argparse
import asyncio
import os

import redis.asyncio as aioredis


async def preload(product_id: str, stock: int, redis_url: str):
    r = await aioredis.from_url(redis_url, decode_responses=True)

    inventory_key = f"flash_sale:product:{product_id}:inventory"
    sale_active_key = f"flash_sale:product:{product_id}:sale_active"

    await r.set(inventory_key, stock)
    await r.set(sale_active_key, "1")

    # Clear any stale waiting room
    waiting_room_key = f"flash_sale:waiting_room:{product_id}"
    await r.delete(waiting_room_key)

    current = await r.get(inventory_key)
    print(f"Inventory loaded: product={product_id}, stock={current}")
    print(f"Sale activated: {sale_active_key} = 1")

    await r.close()


def main():
    parser = argparse.ArgumentParser(description="Preload flash sale inventory")
    parser.add_argument("--product-id", default="a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
    parser.add_argument("--stock", type=int, default=1000)
    parser.add_argument("--redis-url", default=os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    args = parser.parse_args()

    asyncio.run(preload(args.product_id, args.stock, args.redis_url))


if __name__ == "__main__":
    main()
