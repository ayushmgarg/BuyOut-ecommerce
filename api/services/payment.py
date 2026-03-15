"""Payment service — Stripe (test mode) with mock fallback."""

import asyncio
import uuid
from abc import ABC, abstractmethod

import stripe

from api.config import settings
from internal.logging import get_logger

logger = get_logger(__name__)


class PaymentProvider(ABC):
    """Abstract payment provider interface."""

    @abstractmethod
    async def create_payment_intent(
        self, amount_cents: int, currency: str, metadata: dict
    ) -> dict:
        """Create a payment intent. Returns {client_secret, payment_intent_id, amount_cents, currency}."""


class StripeProvider(PaymentProvider):
    """Real Stripe provider (test mode)."""

    async def create_payment_intent(
        self, amount_cents: int, currency: str, metadata: dict
    ) -> dict:
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=currency,
            metadata=metadata,
            automatic_payment_methods={"enabled": True},
        )
        logger.info("stripe_intent_created", intent_id=intent.id)
        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id,
            "amount_cents": amount_cents,
            "currency": currency,
        }


class MockPaymentProvider(PaymentProvider):
    """Mock provider for local development without Stripe keys."""

    async def create_payment_intent(
        self, amount_cents: int, currency: str, metadata: dict
    ) -> dict:
        intent_id = f"mock_pi_{uuid.uuid4().hex[:16]}"
        client_secret = f"{intent_id}_secret_{uuid.uuid4().hex[:12]}"
        logger.info("mock_intent_created", intent_id=intent_id, metadata=metadata)
        return {
            "client_secret": client_secret,
            "payment_intent_id": intent_id,
            "amount_cents": amount_cents,
            "currency": currency,
        }


def get_payment_provider() -> PaymentProvider:
    """Return Stripe or mock provider based on env config."""
    if settings.use_mock_payment:
        logger.warning("using_mock_payment_provider")
        return MockPaymentProvider()
    return StripeProvider()
