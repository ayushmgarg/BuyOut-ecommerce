-- Midnight Product Drop — Database Initialization
-- Runs automatically via docker-entrypoint-initdb.d

-- Migrations are inlined below (individual files in db/migrations/ are for reference only)

-- ============================================================
-- 001: Products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    price_cents     INTEGER NOT NULL,
    total_stock     INTEGER NOT NULL,
    image_url       VARCHAR(512),
    sale_starts_at  TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 002: Orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     VARCHAR(128) NOT NULL,
    product_id                  UUID NOT NULL REFERENCES products(id),
    reservation_id              VARCHAR(128) NOT NULL,
    quantity                    INTEGER NOT NULL DEFAULT 1,
    amount_cents                INTEGER NOT NULL,
    status                      VARCHAR(32) NOT NULL DEFAULT 'confirmed',
    stripe_payment_intent_id    VARCHAR(255),
    idempotency_key             VARCHAR(128) NOT NULL UNIQUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ============================================================
-- 003: Order Events (audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES orders(id),
    event_type  VARCHAR(64) NOT NULL,
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

-- ============================================================
-- 004: Idempotency Keys
-- ============================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key         VARCHAR(128) PRIMARY KEY,
    response    JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours'
);

-- ============================================================
-- Seed Data
-- ============================================================
INSERT INTO products (id, name, description, price_cents, total_stock, image_url, sale_starts_at)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Midnight Edition Sneakers',
    'Limited edition sneakers — only 1,000 pairs available worldwide.',
    14999,
    1000,
    '/images/midnight-sneakers.png',
    now() + INTERVAL '5 minutes'
)
ON CONFLICT (id) DO NOTHING;
