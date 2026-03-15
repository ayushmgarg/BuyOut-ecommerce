"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # PostgreSQL
    postgres_db: str = "midnight_drop"
    postgres_user: str = "midnight"
    postgres_password: str = "midnight_secret"
    postgres_host: str = "postgres"
    postgres_port: int = 5432

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_publishable_key: str = ""

    # JWT
    jwt_secret: str = "change-me-in-production-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    jwt_expiry_seconds: int = 120

    # Sale Config
    reservation_ttl_seconds: int = 120
    sweeper_interval_seconds: int = 30
    waiting_room_batch_size: int = 50

    # Rate Limits
    rate_limit_waiting_room: str = "10/minute"
    rate_limit_reserve: str = "1/minute"
    rate_limit_payment: str = "3/minute"

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    log_level: str = "INFO"

    @property
    def use_mock_payment(self) -> bool:
        """Fall back to mock payment if Stripe keys not configured."""
        return not self.stripe_secret_key

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
