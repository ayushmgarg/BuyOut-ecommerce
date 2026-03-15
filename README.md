# BuyOut — Flash Sale E-Commerce Platform

High-concurrency flash-sale system that guarantees exactly N successful purchases from limited inventory. Features a Nike SNKRS-inspired frontend with real-time observer dashboard. Runs entirely on Docker Compose — zero cloud dependencies.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Frontend    │────▶│   API       │────▶│  PostgreSQL   │
│  Next.js 15  │ WS  │  FastAPI    │     │  16 · :5432   │
│  :3000       │◀────│  :8000      │     └──────────────┘
└─────────────┘     └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Redis 7    │
                    │  :6379      │
                    └──────┬──────┘
                           │
                    ┌──────▼──────────┐
                    │  Worker(s)      │
                    │  Stream Consumer │
                    │  + Expiry Sweep  │
                    └─────────────────┘
```
![Architecture](image1.jpeg)

| Service   | Tech          | Port | Role                                 |
|-----------|---------------|------|--------------------------------------|
| api       | FastAPI       | 8000 | HTTP API + WebSocket                 |
| worker    | asyncio       | --   | Stream consumer + expiry sweeper     |
| frontend  | Next.js 15    | 3000 | SNKRS-style drop UI + observer dashboard |
| redis     | Redis 7       | 6379 | Inventory, reservations, queues      |
| postgres  | PostgreSQL 16 | 5432 | Durable orders, audit log            |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| Backend | FastAPI, Python 3.12, WebSockets, PyJWT |
| Database | PostgreSQL 16 (orders, audit logs, idempotency) |
| Cache/Queue | Redis 7 (inventory, sorted set queue, Pub/Sub, Lua scripts) |
| Infra | Docker Compose (5 services), health checks, readiness probes |
| Testing | Locust load tests, bot simulator, reconciliation scripts |

## Guarantees

- Exactly N successful purchases for N inventory
- Inventory never goes negative (atomic Lua script)
- No double-selling (per-user reservation lock)
- Payment failures return stock (webhook handler)
- Expired reservations return stock (30s sweeper)
- Idempotent order processing (dedup key)

## Prerequisites

- Docker and Docker Compose v2+
- Python 3.11+ (for scripts and tests)
- Node.js 20+ (only for frontend development outside Docker)

## Quick Start

### 1. Clone and Configure

```bash
git clone https://github.com/ayushmgarg/BuyOut-ecommerce.git
cd BuyOut-ecommerce
cp .env.example .env
```

### 2. Start All Services

```bash
docker compose up --build -d
```

Wait for all services to be healthy:

```bash
docker compose ps
```

All services should show `healthy` status. The database schema and seed data are applied automatically on first start via `db/init.sql`.

### 3. Preload Inventory

```bash
python scripts/preload_inventory.py --product-id a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 --stock 100
```

### 4. Open the App

- Frontend: http://localhost:3000
- Observer Dashboard: http://localhost:3000/dashboard
- API health: http://localhost:8000/health
- API docs (Swagger): http://localhost:8000/docs

## Frontend — Nike SNKRS-Style Drop Experience

The frontend is styled after Nike's SNKRS app with bold uppercase typography, crimson accents, and a dark theme. The product is **Air Max Midnight** — a limited-edition sneaker at $149.99, 1,000 pairs.

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Home — floating SVG sneaker hero, countdown timer, "ENTER DRAW" CTA |
| `/waiting-room` | Queue — product strip header, live position (#N of M), estimated wait |
| `/buy` | Purchase — glass card with size selector, reserve button, inline payment modal |
| `/success` | Celebration — confetti particles, "YOU GOT 'EM" with spring animation |
| `/sold-out` | End state — grayscale sneaker, dramatic watermark, restock button |
| `/dashboard` | Observer — real-time metrics, charts, queue visualization, transaction flow |

### Key Components

| Component | Description |
|-----------|-------------|
| `SneakerHero` | SVG Air Max silhouette with floating, glowing, and grayscale variants |
| `CountdownTimerDramatic` | Digit cards with crimson urgency glow, "DROPPING IN" label |
| `StockIndicator` | Live WebSocket stock counter with color-coded accent bar |
| `WaitingRoom` | Queue position display with pulsing rings, auto-redirect on token |
| `PaymentModal` | Inline card payment form with test data prefilled, success animation |
| `LiveStatsBar` | Real-time stock, queue depth, and throughput via WebSocket |
| `BotLauncher` | Collapsible developer tool to spawn 30 / 1K / 10K bot buyers |

### Frontend Hooks

| Hook | Purpose |
|------|---------|
| `useReservation` | State machine: idle → reserving → reserved → paying |
| `useWebSocket` | Stock updates via `/ws/stock`, auto-reconnect |
| `useDashboardWebSocket` | Dashboard metrics via `/ws/dashboard` (500ms interval) |
| `useTimeSeriesBuffer` | Ring buffer (300pts, 5min) with 500ms React throttle |

## Observer Dashboard

Real-time monitoring at http://localhost:3000/dashboard — receives metrics via WebSocket every 500ms.

![Dashboard](image2.jpeg)

- **Metric cards** with sparkline histories (stock, orders, queue depth, throughput, sold-out count)
- **Orders over time** — recharts AreaChart with 5-minute rolling window
- **Queue visualization** — Canvas-based particle system showing users flowing through
- **Transaction flow** — animated pipeline (Queue → Token → Reserve → Pay → Confirm)
- **Event log** — live stream of system events

## Bot Simulation

Built-in bot launcher accessible under "Developer Tools" on the home page. Spawns concurrent bot users that race through the entire purchase flow:

1. Join queue → get token → reserve → pay → confirm order
2. Available counts: 30, 1,000, or 10,000 concurrent bots
3. Bots are staggered to simulate realistic arrival patterns

This is where the **atomic Lua scripts** prove their worth — even under 10K concurrent requests, inventory never goes negative.

### Headless Load Test (Locust)

```bash
pip install locust
locust -f scripts/locustfile.py --host=http://localhost:8000
```

Open http://localhost:8089 for the Locust web UI. For headless mode:

```bash
locust -f scripts/locustfile.py \
  --host=http://localhost:8000 \
  --users 2000 \
  --spawn-rate 200 \
  --headless \
  --run-time 2m
```

## System Flow

```
PRE-SALE          WAITING ROOM        RESERVE           PAY              CONFIRM
preload script -> ZADD waiting_room -> Lua EVALSHA   -> Stripe Intent -> Webhook
SET inv = N      ZRANK position      DECRBY inv       or mock           INSERT order
                 Issue JWT token     SET user lock                      XACK stream
                                    HSET reservation
                                    XADD order stream
```

## Compensation

| Trigger             | Action                                       |
|---------------------|----------------------------------------------|
| Payment fails       | Webhook -> INCRBY stock, DEL user lock        |
| Reservation expires | Sweeper (30s) -> INCRBY stock, DEL user lock  |

## Payment

Uses Stripe test mode. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env`.
If unset, the system falls back to a mock payment provider that auto-succeeds.

The payment modal appears inline on the buy page with test card data prefilled:
- Card: `4242 4242 4242 4242`
- Expiry: `12/28`
- CVC: `123`

## Scaling Workers

Workers consume from a Redis Streams consumer group. Each scaled instance gets a unique consumer name derived from its Docker container hostname.

```bash
docker compose up --scale worker=3
```

Verify:

```bash
docker compose exec redis redis-cli \
  XINFO GROUPS flash_sale:orders:a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
```

## Operational Scripts

| Script                         | Purpose                               | Usage                                          |
|--------------------------------|---------------------------------------|-------------------------------------------------|
| `scripts/preload_inventory.py` | Load stock into Redis, activate sale  | `python scripts/preload_inventory.py --stock 100` |
| `scripts/simulate_flash_sale.py` | CLI bot simulator (full purchase flow) | `python scripts/simulate_flash_sale.py --bots 100` |
| `scripts/reconcile.py`         | Compare Redis vs Postgres state       | `python scripts/reconcile.py`                   |
| `scripts/expire_reservations.py` | Manually release expired reservations | `python scripts/expire_reservations.py --dry-run` |
| `scripts/locustfile.py`        | Load test (1000+ users)               | `locust -f scripts/locustfile.py`               |
| `scripts/reset_all.sh`         | Flush Redis + truncate Postgres       | `bash scripts/reset_all.sh`                     |
| `scripts/run_migrations.py`    | Apply database schema changes         | `python scripts/run_migrations.py`              |

## Verifying Results

```bash
# Check order counts by status
docker compose exec postgres psql -U midnight -d midnight_drop \
  -c "SELECT status, count(*) FROM orders GROUP BY status;"

# Check Redis inventory (should be 0 if all stock sold)
docker compose exec redis redis-cli \
  GET flash_sale:product:a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11:inventory

# Run full reconciliation
python scripts/reconcile.py
```

## Running Tests

```bash
pip install -r requirements.txt
docker compose up redis postgres -d

pytest tests/ -v
pytest tests/unit/ -v              # Unit tests (Lua scripts, tokens, etc.)
pytest tests/integration/ -v       # Integration tests (full flows)
pytest tests/test_reserve.py -v    # HTTP endpoint tests
pytest tests/test_saga.py -v       # Saga orchestrator tests
```

## Project Structure

```
midnight-product-drop/
├── api/                    # FastAPI service (:8000)
│   ├── lua/                # Atomic Lua scripts (reserve, release)
│   ├── routers/            # HTTP + WebSocket endpoints
│   │   ├── reserve.py      # POST /reserve (atomic Lua)
│   │   ├── inventory.py    # GET /inventory, /sale-info
│   │   ├── payment.py      # POST /create-payment-intent
│   │   ├── waiting_room.py # POST /join, GET /status (sorted set queue)
│   │   ├── webhook.py      # POST /webhook/stripe
│   │   ├── ws.py           # WS /ws/stock (Pub/Sub fan-out)
│   │   ├── dashboard_ws.py # WS /ws/dashboard (500ms metrics)
│   │   ├── demo.py         # Bot launcher, reset, chaos endpoints
│   │   └── health.py       # Health + readiness probes
│   ├── services/           # Business logic
│   │   ├── reservation.py  # Lua-backed atomic reserve/release
│   │   ├── waiting_room.py # Sorted set queue management
│   │   ├── token.py        # JWT issuance + consumption tracking
│   │   ├── payment.py      # Stripe + mock payment providers
│   │   ├── order.py        # Postgres order persistence
│   │   ├── stock_broadcast.py    # Redis Pub/Sub → WebSocket fan-out
│   │   └── dashboard_metrics.py  # Metrics aggregation + ring buffer
│   ├── middleware/          # Auth, rate limit, idempotency
│   └── models/             # Pydantic schemas
├── worker/                 # Asyncio stream consumer + sweeper
│   ├── handlers/           # Order confirm, reservation release
│   ├── saga.py             # Multi-step transaction orchestrator
│   └── consumer.py         # Redis Streams consumer
├── frontend/               # Next.js 15 + React 19 + Tailwind v4 (:3000)
│   ├── app/                # Pages: /, /waiting-room, /buy, /success, /sold-out, /dashboard
│   ├── components/         # SneakerHero, PaymentModal, CountdownTimer, StockIndicator, etc.
│   │   └── dashboard/      # MetricCardSpark, TimeSeriesChart, QueueVisualization, TransactionFlow
│   ├── hooks/              # useWebSocket, useReservation, useDashboardWebSocket, useTimeSeriesBuffer
│   └── lib/                # API client, types
├── internal/               # Shared Python utilities
│   ├── constants.py        # Redis key patterns, TTLs
│   ├── redis_client.py     # Connection pool + Lua script loader
│   ├── db_client.py        # asyncpg pool factory
│   └── logging.py          # structlog setup
├── db/                     # Schema + seed data
├── scripts/                # Operational tools
├── tests/                  # Unit, integration, and load tests
├── DEMO_SCRIPT.md          # 3-minute demo walkthrough script
├── docker-compose.yml      # 5-service stack
└── .env.example            # All configuration variables
```

## Reset

```bash
bash scripts/reset_all.sh
```

This flushes Redis and truncates Postgres order tables. Run `preload_inventory.py` again to set up a new sale. You can also use the "Restock & Restart" button on the sold-out page or the "Reset Sale" button in Developer Tools.

## Demo Script

See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for a structured 3-minute walkthrough covering the architecture, drop flow, bot stress testing, real-time dashboard, and key technical innovations.

## Future Production Notes

What would change for a real deployment:

- **Orchestration**: Replace Docker Compose with Kubernetes or ECS for auto-scaling and self-healing
- **Managed Data Stores**: Use ElastiCache/Upstash for Redis, RDS/Neon for PostgreSQL
- **Secrets Management**: Move `JWT_SECRET`, `STRIPE_SECRET_KEY` to AWS Secrets Manager or Vault (not `.env`)
- **Real Payments**: Configure real Stripe keys, register a public webhook URL
- **TLS**: Add nginx or ALB for TLS termination in front of the API
- **Monitoring**: Prometheus metrics on all services, Grafana dashboards for stock/orders/latency
- **Tracing**: OpenTelemetry instrumentation for distributed request tracing
- **Redis HA**: Redis Sentinel or Cluster for high availability
- **CDN**: Deploy frontend to Vercel or Cloudflare for global edge delivery
- **Rate Limiting**: Add IP-based rate limiting at the load balancer level in addition to per-user limits
- **Horizontal Scaling**: Auto-scale API replicas based on CPU/request rate, scale workers based on stream lag
