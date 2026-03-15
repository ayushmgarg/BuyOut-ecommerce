#!/usr/bin/env python3
"""
Flash Sale Simulator — race against bots for limited inventory.

Run this while browsing http://localhost:3000 to experience the queue.
Bots automatically wait for the sale to start (synced with your countdown).

Usage:
    pip install aiohttp
    python scripts/simulate_flash_sale.py --users 30
"""

import argparse
import asyncio
import sys
import time
import uuid

try:
    import aiohttp
except ImportError:
    print("aiohttp is required. Install with: pip install aiohttp")
    sys.exit(1)

API_URL = "http://localhost:8000"
PRODUCT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

# Terminal colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
DIM = "\033[2m"
RESET = "\033[0m"

# Counters
stats = {"joined": 0, "reserved": 0, "purchased": 0, "sold_out": 0, "errors": 0}
stats_lock = asyncio.Lock()


async def update_stat(key: str) -> None:
    async with stats_lock:
        stats[key] += 1


async def wait_for_sale_start(session: aiohttp.ClientSession) -> None:
    """Poll /sale-info until the sale has started."""
    print(f"  {YELLOW}Waiting for sale to start (synced with countdown)...{RESET}")
    while True:
        try:
            async with session.get(
                f"{API_URL}/inventory/sale-info/{PRODUCT_ID}"
            ) as resp:
                if resp.status != 200:
                    await asyncio.sleep(1)
                    continue
                data = await resp.json()

            starts_at = data.get("starts_at")
            if not starts_at:
                print(f"  {RED}No sale start time set. Run: bash scripts/demo.sh{RESET}")
                await asyncio.sleep(2)
                continue

            remaining = starts_at - time.time()
            if remaining <= 0:
                print(f"\r  {GREEN}SALE IS LIVE! Bots unleashed!{RESET}                    ")
                print()
                return

            print(
                f"\r  Sale starts in {remaining:.0f}s... ",
                end="",
                flush=True,
            )
            await asyncio.sleep(1)

        except aiohttp.ClientError:
            print(f"\r  {RED}API not reachable, retrying...{RESET}  ", end="", flush=True)
            await asyncio.sleep(2)


async def simulate_user(
    session: aiohttp.ClientSession,
    user_id: str,
    start_delay: float,
) -> None:
    """Simulate a single bot user going through the full purchase flow."""
    await asyncio.sleep(start_delay)

    try:
        # 1. Join waiting room (may retry if sale hasn't started yet)
        for attempt in range(5):
            async with session.post(
                f"{API_URL}/join-waiting-room",
                json={"user_id": user_id, "product_id": PRODUCT_ID},
            ) as resp:
                if resp.status == 425:
                    await asyncio.sleep(0.5)
                    continue
                if resp.status != 200:
                    await update_stat("errors")
                    return
                data = await resp.json()
                break
        else:
            await update_stat("errors")
            return

        position = data.get("position", "?")
        token = data.get("token")
        await update_stat("joined")
        print(f"  {DIM}[{user_id}]{RESET} Joined queue at #{position}")

        # 2. Poll for token if not immediately ready
        if not token:
            for _ in range(60):
                await asyncio.sleep(2)
                async with session.get(
                    f"{API_URL}/waiting-room-status",
                    params={"product_id": PRODUCT_ID, "user_id": user_id},
                ) as resp:
                    if resp.status != 200:
                        continue
                    data = await resp.json()
                    if data.get("status") == "ready" and data.get("token"):
                        token = data["token"]
                        break

        if not token:
            print(f"  {DIM}[{user_id}]{RESET} {YELLOW}Timed out waiting for token{RESET}")
            return

        # 3. Reserve stock
        async with session.post(
            f"{API_URL}/reserve",
            json={
                "product_id": PRODUCT_ID,
                "quantity": 1,
                "idempotency_key": str(uuid.uuid4()),
            },
            headers={"Authorization": f"Bearer {token}"},
        ) as resp:
            data = await resp.json()

            if resp.status == 410:
                await update_stat("sold_out")
                print(f"  {DIM}[{user_id}]{RESET} {RED}SOLD OUT{RESET}")
                return

            if resp.status != 200:
                await update_stat("errors")
                print(
                    f"  {DIM}[{user_id}]{RESET} {RED}Reserve failed: "
                    f"{data.get('detail', resp.status)}{RESET}"
                )
                return

        reservation_id = data["reservation_id"]
        await update_stat("reserved")
        print(
            f"  {DIM}[{user_id}]{RESET} {CYAN}Reserved{RESET} "
            f"(id: {reservation_id[:8]}...)"
        )

        # Small delay to simulate "thinking about payment"
        await asyncio.sleep(0.5)

        # 4. Create payment intent
        async with session.post(
            f"{API_URL}/create-payment-intent",
            json={"reservation_id": reservation_id, "product_id": PRODUCT_ID},
        ) as resp:
            if resp.status != 200:
                await update_stat("errors")
                return
            payment_data = await resp.json()

        payment_intent_id = payment_data.get("payment_intent_id", "")

        # 5. Confirm payment via mock webhook
        async with session.post(
            f"{API_URL}/webhook/stripe",
            json={
                "type": "payment_intent.succeeded",
                "data": {
                    "object": {
                        "id": payment_intent_id,
                        "amount": 14999,
                        "metadata": {
                            "reservation_id": reservation_id,
                            "product_id": PRODUCT_ID,
                            "user_id": user_id,
                        },
                    },
                },
            },
        ) as resp:
            if resp.status == 200:
                await update_stat("purchased")
                print(
                    f"  {DIM}[{user_id}]{RESET} {GREEN}PURCHASED!{RESET}"
                )
            else:
                await update_stat("errors")

    except aiohttp.ClientError as e:
        await update_stat("errors")
        print(f"  {DIM}[{user_id}]{RESET} {RED}Connection error: {e}{RESET}")


async def main() -> None:
    global API_URL

    parser = argparse.ArgumentParser(
        description="Simulate a flash sale with concurrent bot users"
    )
    parser.add_argument(
        "--users", type=int, default=30, help="Number of bot users (default: 30)"
    )
    parser.add_argument(
        "--stagger",
        type=float,
        default=0.3,
        help="Seconds between each bot joining (default: 0.3)",
    )
    parser.add_argument(
        "--api-url",
        default=API_URL,
        help=f"API base URL (default: {API_URL})",
    )
    args = parser.parse_args()

    API_URL = args.api_url

    print()
    print(f"  {CYAN}{'=' * 50}{RESET}")
    print(f"  {CYAN}  MIDNIGHT PRODUCT DROP — Flash Sale Simulator{RESET}")
    print(f"  {CYAN}{'=' * 50}{RESET}")
    print()
    print(f"  Bots:    {args.users}")
    print(f"  Stagger: {args.stagger}s between arrivals")
    print()

    # Wait for sale to start (synced with server countdown)
    async with aiohttp.ClientSession() as session:
        await wait_for_sale_start(session)

    start_time = time.monotonic()

    async with aiohttp.ClientSession() as session:
        tasks = []
        for i in range(args.users):
            user_id = f"bot_{i:04d}"
            delay = i * args.stagger
            tasks.append(simulate_user(session, user_id, delay))

        await asyncio.gather(*tasks)

    elapsed = time.monotonic() - start_time

    # Check final inventory
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{API_URL}/inventory/{PRODUCT_ID}"
            ) as resp:
                inv_data = await resp.json()
                final_stock = inv_data.get("stock", "?")
    except Exception:
        final_stock = "?"

    print()
    print(f"  {CYAN}{'=' * 50}{RESET}")
    print(f"  {CYAN}  SIMULATION COMPLETE{RESET}")
    print(f"  {CYAN}{'=' * 50}{RESET}")
    print()
    print(f"  Elapsed:     {elapsed:.1f}s")
    print(f"  Joined:      {stats['joined']}")
    print(f"  Reserved:    {stats['reserved']}")
    print(f"  Purchased:   {GREEN}{stats['purchased']}{RESET}")
    print(f"  Sold out:    {RED}{stats['sold_out']}{RESET}")
    print(f"  Errors:      {stats['errors']}")
    print(f"  Final stock: {YELLOW}{final_stock}{RESET}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
