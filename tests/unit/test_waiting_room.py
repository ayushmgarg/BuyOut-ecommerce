"""Unit tests for waiting room ZSET operations."""

import pytest

from api.services.waiting_room import (
    join_waiting_room,
    get_position,
    get_waiting_room_size,
    remove_from_waiting_room,
)


@pytest.mark.asyncio
async def test_join_and_get_position(redis_client):
    pos = await join_waiting_room(redis_client, "prod1", "user1")
    assert pos == 0

    pos2 = await join_waiting_room(redis_client, "prod1", "user2")
    assert pos2 == 1

    position = await get_position(redis_client, "prod1", "user1")
    assert position == 0


@pytest.mark.asyncio
async def test_join_idempotent(redis_client):
    """Joining twice should not change position."""
    await join_waiting_room(redis_client, "prod1", "user1")
    await join_waiting_room(redis_client, "prod1", "user1")

    size = await get_waiting_room_size(redis_client, "prod1")
    assert size == 1


@pytest.mark.asyncio
async def test_remove_from_waiting_room(redis_client):
    await join_waiting_room(redis_client, "prod1", "user1")
    await remove_from_waiting_room(redis_client, "prod1", "user1")

    pos = await get_position(redis_client, "prod1", "user1")
    assert pos is None
