#!/bin/bash
# Demo launcher — reset state, preload inventory, set sale start time.
# Usage: bash scripts/demo.sh [countdown_seconds]
set -euo pipefail

COUNTDOWN=${1:-30}
PID="a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

CYAN='\033[96m'
GREEN='\033[92m'
YELLOW='\033[93m'
RESET='\033[0m'

echo ""
echo -e "  ${CYAN}========================================${RESET}"
echo -e "  ${CYAN}  MIDNIGHT PRODUCT DROP — Demo Setup${RESET}"
echo -e "  ${CYAN}========================================${RESET}"
echo ""

# 1. Reset Redis
echo -e "  ${YELLOW}Flushing Redis...${RESET}"
docker compose exec redis redis-cli FLUSHALL > /dev/null 2>&1
echo "  Done."

# 2. Reset Postgres
echo -e "  ${YELLOW}Resetting Postgres...${RESET}"
docker compose exec postgres psql -U midnight -d midnight_drop -c "
  TRUNCATE order_events, orders CASCADE;
  DELETE FROM idempotency_keys;
" > /dev/null 2>&1
echo "  Done."

# 3. Preload inventory
echo -e "  ${YELLOW}Loading inventory (100 units)...${RESET}"
docker compose exec redis redis-cli SET "flash_sale:product:${PID}:inventory" 100 > /dev/null 2>&1
docker compose exec redis redis-cli SET "flash_sale:product:${PID}:sale_active" 1 > /dev/null 2>&1
echo "  Done."

# 4. Set sale start time (now + countdown seconds)
STARTS_AT=$(date +%s)
STARTS_AT=$((STARTS_AT + COUNTDOWN))
echo -e "  ${YELLOW}Setting sale start time (${COUNTDOWN}s from now)...${RESET}"
docker compose exec redis redis-cli SET "flash_sale:product:${PID}:starts_at" "${STARTS_AT}" > /dev/null 2>&1
echo "  Done."

# 5. Verify
STOCK=$(docker compose exec redis redis-cli GET "flash_sale:product:${PID}:inventory")
echo ""
echo -e "  ${GREEN}Inventory: ${STOCK} units${RESET}"
echo -e "  ${GREEN}Sale starts in: ${COUNTDOWN} seconds${RESET}"
echo ""
echo -e "  ${CYAN}========================================${RESET}"
echo -e "  ${CYAN}  GO! Open your browser + start bots${RESET}"
echo -e "  ${CYAN}========================================${RESET}"
echo ""
echo "  1. Open http://localhost:3000 (countdown synced to server)"
echo "  2. In another terminal:"
echo ""
echo -e "     ${GREEN}python scripts/simulate_flash_sale.py --users 30${RESET}"
echo ""
echo "  Bots will auto-wait for the same countdown to finish."
echo "  When it hits 0, everyone floods the queue simultaneously!"
echo ""
