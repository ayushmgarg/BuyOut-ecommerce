# Load Testing

## Prerequisites

```bash
pip install locust
```

## Run

```bash
# Start services
docker compose up --build
python scripts/preload_inventory.py --stock 100

# Run Locust
locust -f scripts/locustfile.py --host http://localhost:8000 --users 1000 --spawn-rate 100
```

Open http://localhost:8089 for the Locust web UI.

## Verify

After the test completes:

```bash
# Check exactly 100 orders
docker compose exec postgres psql -U midnight -d midnight_drop -c "SELECT count(*) FROM orders;"

# Check Redis inventory = 0
docker compose exec redis redis-cli GET flash_sale:product:a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11:inventory
```
