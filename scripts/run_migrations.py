"""Run SQL migrations in order against PostgreSQL."""

import asyncio
import os
from pathlib import Path

import asyncpg


MIGRATIONS_DIR = Path(__file__).parent.parent / "db" / "migrations"


async def run_migrations():
    conn = await asyncpg.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        user=os.getenv("POSTGRES_USER", "midnight"),
        password=os.getenv("POSTGRES_PASSWORD", "midnight_secret"),
        database=os.getenv("POSTGRES_DB", "midnight_drop"),
    )

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))

    for migration in migration_files:
        print(f"Running {migration.name}...")
        sql = migration.read_text()
        await conn.execute(sql)
        print(f"  Done: {migration.name}")

    # Run seed data
    seed_file = Path(__file__).parent.parent / "db" / "seed" / "seed_products.sql"
    if seed_file.exists():
        print(f"Running {seed_file.name}...")
        await conn.execute(seed_file.read_text())
        print(f"  Done: {seed_file.name}")

    await conn.close()
    print("All migrations complete.")


if __name__ == "__main__":
    asyncio.run(run_migrations())
