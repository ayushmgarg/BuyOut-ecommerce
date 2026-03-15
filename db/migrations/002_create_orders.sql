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
