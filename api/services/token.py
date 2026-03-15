"""PyJWT token issuance and verification for reservation access."""

import uuid
from datetime import datetime, timezone

import jwt
import redis.asyncio as aioredis

from api.config import settings
from internal.constants import TOKEN_USED_KEY, DEFAULT_TOKEN_USED_TTL


def issue_token(user_id: str, product_id: str) -> str:
    """Sign a short-lived JWT granting access to /reserve."""
    now = datetime.now(timezone.utc)
    jti = str(uuid.uuid4())
    payload = {
        "sub": user_id,
        "pid": product_id,
        "scope": "reserve",
        "jti": jti,
        "iat": now,
        "exp": now.timestamp() + settings.jwt_expiry_seconds,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_token(token: str) -> dict:
    """Decode and validate a JWT. Raises jwt.PyJWTError on failure."""
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
    )


async def consume_token(redis: aioredis.Redis, jti: str) -> bool:
    """Mark a token JTI as used. Returns True if this is the first use."""
    key = TOKEN_USED_KEY.format(jti=jti)
    was_set = await redis.set(key, "1", nx=True, ex=DEFAULT_TOKEN_USED_TTL)
    return was_set is not None
