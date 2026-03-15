"""Pydantic request/response models for all API endpoints."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── Waiting Room ──

class JoinWaitingRoomRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    product_id: str


class WaitingRoomPositionResponse(BaseModel):
    status: str  # "waiting" | "ready"
    position: int | None = None
    total: int | None = None
    estimated_wait_seconds: int | None = None
    token: str | None = None


# ── Reserve ──

class ReserveRequest(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1, le=5)
    idempotency_key: str = Field(..., min_length=1, max_length=128)


class ReserveResponse(BaseModel):
    status: str  # "reserved" | "user_limit_exceeded" | "out_of_stock"
    reservation_id: str | None = None
    expires_at: datetime | None = None
    message: str | None = None


# ── Payment ──

class CreatePaymentIntentRequest(BaseModel):
    reservation_id: str
    product_id: str


class CreatePaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount_cents: int
    currency: str = "usd"


# ── Inventory ──

class InventoryResponse(BaseModel):
    product_id: str
    stock: int
    sale_active: bool


# ── WebSocket ──

class StockUpdate(BaseModel):
    product_id: str
    stock: int
    event: str  # "reserved" | "confirmed" | "released" | "sold_out"
    timestamp: datetime


# ── Order ──

class OrderResponse(BaseModel):
    id: UUID
    user_id: str
    product_id: UUID
    reservation_id: str
    quantity: int
    amount_cents: int
    status: str
    created_at: datetime


# ── Health ──

class HealthResponse(BaseModel):
    status: str
    redis: str
    postgres: str
