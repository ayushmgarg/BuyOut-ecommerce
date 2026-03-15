"""Redis async connection factory and Lua script loader."""

from pathlib import Path

import redis.asyncio as aioredis

# Primary Lua scripts location: api/lua/
# Fallback: internal/lua_scripts/ (for worker service)
_API_LUA_DIR = Path(__file__).parent.parent / "api" / "lua"
_INTERNAL_LUA_DIR = Path(__file__).parent / "lua_scripts"


async def create_redis_pool(redis_url: str) -> aioredis.Redis:
    """Create and return an async Redis connection pool."""
    return aioredis.from_url(
        redis_url,
        decode_responses=True,
        max_connections=50,
    )


def load_lua_script(name: str) -> str:
    """Load a Lua script by name. Checks api/lua/ first, then internal/lua_scripts/."""
    api_path = _API_LUA_DIR / f"{name}.lua"
    if api_path.exists():
        return api_path.read_text()

    internal_path = _INTERNAL_LUA_DIR / f"{name}.lua"
    if internal_path.exists():
        return internal_path.read_text()

    raise FileNotFoundError(f"Lua script '{name}' not found in {_API_LUA_DIR} or {_INTERNAL_LUA_DIR}")


async def register_lua_script(redis: aioredis.Redis, name: str):
    """Load and register a Lua script, returning a callable Script object."""
    source = load_lua_script(name)
    return redis.register_script(source)
