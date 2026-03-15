#!/bin/bash
# Reset all state — flush Redis and recreate Postgres tables
set -euo pipefail

echo "Flushing Redis..."
docker compose exec redis redis-cli FLUSHALL

echo "Resetting Postgres..."
docker compose exec postgres psql -U midnight -d midnight_drop -c "
  TRUNCATE order_events, orders CASCADE;
  DELETE FROM idempotency_keys;
"

echo "Done. Run preload_inventory.py to set up a new sale."
