"""Inventory endpoint — read current stock level."""

from fastapi import APIRouter, Depends

import redis.asyncio as aioredis

from api.dependencies import get_redis
from api.models.schemas import InventoryResponse
from internal.constants import INVENTORY_KEY, SALE_ACTIVE_KEY, SALE_STARTS_AT_KEY

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/{product_id}", response_model=InventoryResponse)
async def get_inventory(
    product_id: str,
    redis: aioredis.Redis = Depends(get_redis),
):
    inventory_key = INVENTORY_KEY.format(product_id=product_id)
    sale_active_key = SALE_ACTIVE_KEY.format(product_id=product_id)

    stock = await redis.get(inventory_key)
    active = await redis.get(sale_active_key)

    return InventoryResponse(
        product_id=product_id,
        stock=int(stock) if stock else 0,
        sale_active=active == "1",
    )


@router.get("/sale-info/{product_id}")
async def get_sale_info(
    product_id: str,
    redis: aioredis.Redis = Depends(get_redis),
):
    starts_at_key = SALE_STARTS_AT_KEY.format(product_id=product_id)
    inventory_key = INVENTORY_KEY.format(product_id=product_id)
    sale_active_key = SALE_ACTIVE_KEY.format(product_id=product_id)

    starts_at = await redis.get(starts_at_key)
    stock = await redis.get(inventory_key)
    active = await redis.get(sale_active_key)

    return {
        "product_id": product_id,
        "starts_at": float(starts_at) if starts_at else None,
        "stock": int(stock) if stock else 0,
        "sale_active": active == "1",
    }
