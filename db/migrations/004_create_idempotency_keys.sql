CREATE TABLE IF NOT EXISTS idempotency_keys (
    key         VARCHAR(128) PRIMARY KEY,
    response    JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours'
);
