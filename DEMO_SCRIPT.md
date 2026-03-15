# BuyOut — Flash Sale E-Commerce Platform | Demo Script

**Duration:** ~3 minutes
**Ports:** Frontend `:3000` | API `:8000` | Dashboard `:3000/dashboard`

---

## Opening (10s)

> This is BuyOut — a real-time flash sale platform that handles thousands of concurrent buyers competing for limited inventory. It demonstrates atomic inventory management, queue fairness, live payment processing, and full-stack observability — all running on Redis, PostgreSQL, FastAPI, and Next.js.

---

## 1. Architecture Overview (30s)

> The system has five services orchestrated with Docker Compose:

- **FastAPI backend** — REST API + two WebSocket channels (stock updates, dashboard metrics)
- **Redis** — Inventory counter, waiting room queue (sorted sets), reservation locks, Pub/Sub for real-time stock broadcast, and **Lua scripts for atomic operations** so no two buyers can claim the same unit
- **PostgreSQL** — Persistent order storage with idempotency keys and audit event logs
- **Background Worker** — Sweeps expired reservations (TTL-based cleanup) and releases stock back
- **Next.js frontend** — Nike SNKRS-inspired UI with Framer Motion animations and live WebSocket data

---

## 2. The Drop Flow (show `:3000`) (40s)

> The homepage shows a countdown timer to the drop. The product — Air Max Midnight — is priced at $149.99, limited to 1,000 pairs, one per customer.

- **Countdown reaches zero** → sale goes live, "ENTER DRAW" button appears
- **Clicking "Enter Draw"** → user joins a **Redis sorted set** queue, scored by join timestamp for fairness
- **Queue page** polls every 2 seconds — shows position (#1 of N), estimated wait, and live stock count via WebSocket
- **When your turn comes** → server issues a **short-lived JWT token** scoped to this product. Token is consumed on use — can't be replayed.
- **Buy page** → glass card with size selector, "RESERVE" button. Reservation uses a **Redis Lua script** that atomically decrements inventory and creates a lock — this is the key innovation preventing overselling under concurrency.
- **Payment modal** → processes payment via Stripe webhook simulation, confirms the order in Postgres with idempotency protection
- **Success** → confetti celebration, "YOU GOT 'EM"

---

## 3. Bot Simulation — Stress Testing (30s)

> Now the interesting part. Under "Developer Tools" there's a bot launcher. We can spawn **30, 1,000, or 10,000** concurrent bot users that race through the entire purchase flow simultaneously.

- Each bot: joins queue → gets token → reserves → pays → confirms order
- Bots are staggered to simulate realistic arrival patterns
- This is where the **atomic Lua scripts** prove their worth — even under 10K concurrent requests, inventory never goes negative and no two buyers get the same unit

---

## 4. Real-Time Observer Dashboard (show `:3000/dashboard`) (40s)

> The dashboard receives metrics via WebSocket every 500ms. Everything updates live as bots flood the system:

- **Metric cards** with sparkline histories — stock, confirmed orders, queue depth, throughput (req/s), sold-out rejections
- **Orders over time graph** — recharts AreaChart with a 5-minute rolling window, 300 data points
- **Queue visualization** — Canvas-based particle system showing users flowing through the queue in real-time
- **Transaction flow** — animated pipeline (Queue → Token → Reserve → Pay → Confirm) showing orders progressing through each stage
- **Event log** — live stream of system events (reservations, payments, sold-out events)
- The dashboard uses a custom **ring buffer hook** (`useTimeSeriesBuffer`) that downsamples to 1 point/sec and throttles React re-renders to 500ms — so it stays smooth even under heavy load

---

## 5. Key Technical Innovations (30s)

> Six things that make this system production-grade:

1. **Atomic inventory with Lua scripts** — Reserve and release operations are single Redis commands. No race conditions, no overselling.
2. **Sorted set queue with batch gating** — Fair FIFO ordering. Front N users get tokens immediately; the rest wait.
3. **Idempotency at every layer** — Duplicate requests to reserve or pay are safely ignored (Redis locks + Postgres unique constraints).
4. **TTL-based reservation expiry** — If a user reserves but never pays, the background worker reclaims that unit after timeout.
5. **Pub/Sub stock broadcast** — Every inventory change publishes to a Redis channel, fanning out to all connected WebSocket clients instantly.
6. **Reconciliation script** — An audit tool that cross-checks Redis inventory state against Postgres order records to detect any drift.

---

## 6. Live Demo — Full Cycle (30s)

> *[On screen: start from homepage]*

1. Wait for countdown → click "Enter Draw"
2. Watch queue position count down → get redirected to buy page
3. Click "Reserve" → payment modal opens with test card prefilled
4. Click "Pay $149.99" → success page with confetti
5. Open dashboard in another tab → launch 1,000 bots
6. Watch all dashboard panels light up in real-time as bots flood the system
7. Stock hits zero → sold-out page with grayscale sneaker
8. Click "Restock & Restart" → system resets, ready for another drop

---

## Closing (10s)

> BuyOut handles the hardest problem in e-commerce: selling limited inventory to thousands of concurrent users without overselling, without unfairness, and with full observability. Every component — from the Lua atomics to the WebSocket dashboard — works together to make that possible.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| Backend | FastAPI, Python 3.12, WebSockets, PyJWT |
| Database | PostgreSQL 16 (orders, audit logs, idempotency) |
| Cache/Queue | Redis 7 (inventory, sorted set queue, Pub/Sub, Lua scripts) |
| Infra | Docker Compose (5 services), health checks, readiness probes |
| Testing | Locust load tests, bot simulator, reconciliation scripts |
