"""Redis key prefixes, TTL defaults, and system-wide constants."""

# ── Redis Key Prefixes ──
INVENTORY_KEY = "flash_sale:product:{product_id}:inventory"
WAITING_ROOM_KEY = "flash_sale:waiting_room:{product_id}"
RESERVATION_KEY = "flash_sale:reservation:{reservation_id}"
USER_RESERVED_KEY = "flash_sale:user:{product_id}:{user_id}:reserved"
ORDER_STREAM_KEY = "flash_sale:orders:{product_id}"
IDEMPOTENCY_KEY = "flash_sale:idempotency:{key}"
TOKEN_USED_KEY = "flash_sale:token:used:{jti}"
STOCK_CHANNEL_KEY = "flash_sale:stock_channel:{product_id}"
SALE_ACTIVE_KEY = "flash_sale:product:{product_id}:sale_active"
SALE_STARTS_AT_KEY = "flash_sale:product:{product_id}:starts_at"

# ── Dashboard Metrics ──
SOLD_OUT_COUNTER_KEY = "flash_sale:product:{product_id}:sold_out_count"
REQUEST_COUNTER_KEY = "flash_sale:product:{product_id}:request_count"

# ── TTL Defaults (seconds) ──
DEFAULT_RESERVATION_TTL = 120
DEFAULT_TOKEN_TTL = 120
DEFAULT_IDEMPOTENCY_TTL = 3600
DEFAULT_TOKEN_USED_TTL = 300

# ── Worker ──
CONSUMER_GROUP_NAME = "order_workers"
CONSUMER_NAME_PREFIX = "consumer"
SWEEPER_INTERVAL = 30

# ── Rate Limits ──
DEFAULT_RATE_LIMIT_WAITING_ROOM = "10/minute"
DEFAULT_RATE_LIMIT_RESERVE = "1/minute"
DEFAULT_RATE_LIMIT_PAYMENT = "3/minute"

# ── Waiting Room ──
DEFAULT_BATCH_SIZE = 50
