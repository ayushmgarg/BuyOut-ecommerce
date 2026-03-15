"""Manual reservation expiry tool — force-expire stale reservations via CLI.

Unlike worker/expire_reservations.py (continuous background loop), this is an
on-demand ops tool for debugging or emergency stock recovery.
"""

import argparse
import asyncio
import os
import time
from pathlib import Path

import redis.asyncio as aioredis


_PROJECT_ROOT = Path(__file__).parent.parent
_LUA_PATHS = [
    _PROJECT_ROOT / "api" / "lua" / "release.lua",
    _PROJECT_ROOT / "internal" / "lua_scripts" / "release_stock.lua",
]


def _load_release_script_source() -> str:
    """Load the release Lua script from disk."""
    for path in _LUA_PATHS:
        if path.exists():
            return path.read_text()
    raise FileNotFoundError(f"Release Lua script not found at any of: {_LUA_PATHS}")


async def _find_product_id(r: aioredis.Redis, user_id: str) -> str | None:
    """Find product_id from a user's reservation lock key."""
    cursor = "0"
    while True:
        cursor, keys = await r.scan(
            cursor=cursor,
            match=f"flash_sale:user:*:{user_id}:reserved",
            count=50,
        )
        if keys:
            parts = keys[0].split(":")
            if len(parts) >= 4:
                return parts[2]
        if cursor == "0":
            break
    return None


async def scan_reservations(
    r: aioredis.Redis,
    force_all: bool,
    product_id_filter: str | None,
) -> list[dict]:
    """Scan Redis for reservations eligible for release."""
    now = int(time.time())
    results = []
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

            status = reservation.get("status", "")
            if status != "reserved":
                continue

            user_id = reservation.get("user_id", "")
            if not user_id:
                continue

            expires_at_str = reservation.get("expires_at", "0")
            try:
                expires_at = int(expires_at_str)
            except (ValueError, TypeError):
                continue

            if not force_all and expires_at >= now:
                continue

            reservation_id = key.split(":")[-1]

            product_id = await _find_product_id(r, user_id)
            if product_id_filter and product_id != product_id_filter:
                continue

            results.append({
                "reservation_id": reservation_id,
                "user_id": user_id,
                "product_id": product_id or "unknown",
                "expires_at": expires_at,
                "seconds_ago": max(0, now - expires_at),
            })

        if cursor == "0":
            break

    return results


async def run(redis_url: str, force_all: bool, dry_run: bool, product_id_filter: str | None):
    """Main entry: scan and optionally release expired reservations."""
    r = await aioredis.from_url(redis_url, decode_responses=True)

    try:
        print("Scanning for expired reservations...")
        reservations = await scan_reservations(r, force_all, product_id_filter)

        if not reservations:
            print("No expired reservations found.")
            return

        print(f"Found {len(reservations)} reservation(s) to release.\n")

        if dry_run:
            print("[DRY RUN] Would release:")
            for res in reservations:
                label = f"expired {res['seconds_ago']}s ago" if not force_all else "force"
                print(f"  {res['reservation_id']} (user: {res['user_id']}, product: {res['product_id']}, {label})")
            return

        # Load and register the release Lua script
        source = _load_release_script_source()
        release_script = r.register_script(source)

        released = 0
        already_released = 0
        errors = 0

        for res in reservations:
            rid = res["reservation_id"]
            pid = res["product_id"]
            uid = res["user_id"]

            if pid == "unknown":
                print(f"  {rid}... SKIPPED (product_id unknown)")
                errors += 1
                continue

            inventory_key = f"flash_sale:product:{pid}:inventory"
            user_key = f"flash_sale:user:{pid}:{uid}:reserved"
            reservation_key = f"flash_sale:reservation:{rid}"

            try:
                result = await release_script(
                    keys=[inventory_key, user_key, reservation_key],
                    args=["1"],
                )
                print(f"  {rid}... {result}")
                if result == "RELEASED":
                    released += 1
                else:
                    already_released += 1
            except Exception as exc:
                print(f"  {rid}... ERROR: {exc}")
                errors += 1

        print(f"\nSummary: {released} released, {already_released} already_released, {errors} errors")

    finally:
        await r.close()


def main():
    parser = argparse.ArgumentParser(description="Manually expire stale reservations")
    parser.add_argument("--redis-url", default=os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    parser.add_argument("--force-all", action="store_true", help="Release ALL 'reserved' reservations, not just expired")
    parser.add_argument("--dry-run", action="store_true", help="Scan and report without releasing")
    parser.add_argument("--product-id", default=None, help="Only process reservations for this product")
    args = parser.parse_args()

    asyncio.run(run(args.redis_url, args.force_all, args.dry_run, args.product_id))


if __name__ == "__main__":
    main()
