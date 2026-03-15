"""Locust load test — simulates 1000+ concurrent users in a flash sale."""

import uuid

from locust import HttpUser, task, between, events


class FlashSaleUser(HttpUser):
    """Simulates a user going through the full flash sale flow."""

    wait_time = between(0.1, 0.5)
    host = "http://localhost:8000"

    def on_start(self):
        self.user_id = f"loadtest_{uuid.uuid4().hex[:12]}"
        self.product_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
        self.token = None
        self.reservation_id = None

    @task(1)
    def full_purchase_flow(self):
        # Step 1: Join waiting room
        resp = self.client.post(
            "/join-waiting-room",
            json={
                "user_id": self.user_id,
                "product_id": self.product_id,
            },
            name="/join-waiting-room",
        )

        if resp.status_code != 200:
            return

        data = resp.json()
        if data.get("status") == "ready" and data.get("token"):
            self.token = data["token"]
        else:
            # Check position until ready
            for _ in range(10):
                pos_resp = self.client.get(
                    "/waiting-room-status",
                    params={
                        "product_id": self.product_id,
                        "user_id": self.user_id,
                    },
                    name="/waiting-room-status",
                )
                if pos_resp.status_code == 200:
                    pos_data = pos_resp.json()
                    if pos_data.get("status") == "ready":
                        self.token = pos_data.get("token")
                        break

        if not self.token:
            return

        # Step 2: Reserve
        idempotency_key = str(uuid.uuid4())
        reserve_resp = self.client.post(
            "/reserve",
            json={
                "product_id": self.product_id,
                "quantity": 1,
                "idempotency_key": idempotency_key,
            },
            headers={"Authorization": f"Bearer {self.token}"},
            name="/reserve",
        )

        if reserve_resp.status_code == 200:
            reserve_data = reserve_resp.json()
            self.reservation_id = reserve_data.get("reservation_id")

            # Step 3: Create payment intent
            self.client.post(
                "/create-payment-intent",
                json={
                    "reservation_id": self.reservation_id,
                    "product_id": self.product_id,
                },
                name="/create-payment-intent",
            )

    @task(3)
    def check_inventory(self):
        """High-frequency stock checks (simulates polling)."""
        self.client.get(
            f"/inventory/{self.product_id}",
            name="/inventory/[productId]",
        )
