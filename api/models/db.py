"""Database model definitions — column references for raw SQL queries."""

# Table: products
PRODUCTS_COLUMNS = [
    "id",            # UUID PK
    "name",          # VARCHAR(255)
    "description",   # TEXT
    "price_cents",   # INTEGER
    "total_stock",   # INTEGER
    "image_url",     # VARCHAR(512)
    "sale_starts_at",  # TIMESTAMPTZ
    "created_at",    # TIMESTAMPTZ
]

# Table: orders
ORDERS_COLUMNS = [
    "id",                        # UUID PK
    "user_id",                   # VARCHAR(128)
    "product_id",                # UUID FK → products
    "reservation_id",            # VARCHAR(128)
    "quantity",                  # INTEGER
    "amount_cents",              # INTEGER
    "status",                    # VARCHAR(32)
    "stripe_payment_intent_id",  # VARCHAR(255)
    "idempotency_key",           # VARCHAR(128) UNIQUE
    "created_at",                # TIMESTAMPTZ
    "updated_at",                # TIMESTAMPTZ
]

# Table: order_events
ORDER_EVENTS_COLUMNS = [
    "id",          # UUID PK
    "order_id",    # UUID FK → orders
    "event_type",  # VARCHAR(64)
    "payload",     # JSONB
    "created_at",  # TIMESTAMPTZ
]
