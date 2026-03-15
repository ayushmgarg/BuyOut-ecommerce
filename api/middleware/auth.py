"""JWT authentication dependency for protected endpoints."""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import redis.asyncio as aioredis

from api.dependencies import get_redis
from api.services.token import verify_token, consume_token

import jwt

security = HTTPBearer()


async def require_reserve_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    """Validate JWT and ensure it has reserve scope and hasn't been used.

    Returns the decoded token payload.
    """
    try:
        payload = verify_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )

    if payload.get("scope") != "reserve":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token does not have reserve scope",
        )

    jti = payload.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing jti claim",
        )

    is_first_use = await consume_token(redis, jti)
    if not is_first_use:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Token has already been used",
        )

    return payload
