"""Async PostgreSQL connection pool factory using asyncpg."""

import asyncpg


async def create_db_pool(
    host: str,
    port: int,
    user: str,
    password: str,
    database: str,
    min_size: int = 5,
    max_size: int = 20,
) -> asyncpg.Pool:
    """Create and return an asyncpg connection pool."""
    return await asyncpg.create_pool(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        min_size=min_size,
        max_size=max_size,
    )
