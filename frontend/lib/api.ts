const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  joinWaitingRoom(productId: string, userId: string) {
    return fetchJson(`${API_URL}/join-waiting-room`, {
      method: "POST",
      body: JSON.stringify({ product_id: productId, user_id: userId }),
    });
  },

  getPosition(productId: string, userId: string) {
    const params = new URLSearchParams({ product_id: productId, user_id: userId });
    return fetchJson(`${API_URL}/waiting-room-status?${params}`);
  },

  async reserve(productId: string, token: string) {
    const idempotencyKey = crypto.randomUUID();
    const res = await fetch(`${API_URL}/reserve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        product_id: productId,
        quantity: 1,
        idempotency_key: idempotencyKey,
      }),
    });

    if (res.status === 410) {
      return { status: "out_of_stock", reservation_id: null, expires_at: null };
    }
    if (res.status === 409) {
      return { status: "user_limit_exceeded", reservation_id: null, expires_at: null, message: "You already have a reservation" };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },

  createPaymentIntent(reservationId: string, productId: string) {
    return fetchJson(`${API_URL}/create-payment-intent`, {
      method: "POST",
      body: JSON.stringify({
        reservation_id: reservationId,
        product_id: productId,
      }),
    });
  },

  getInventory(productId: string) {
    return fetchJson(`${API_URL}/inventory/${productId}`);
  },

  getSaleInfo(productId: string) {
    return fetchJson(`${API_URL}/inventory/sale-info/${productId}`);
  },

  launchBots(numBots: number = 30) {
    return fetchJson(`${API_URL}/demo/launch-bots`, {
      method: "POST",
      body: JSON.stringify({ num_bots: numBots, stagger: 0.3 }),
    });
  },

  getBotStatus() {
    return fetchJson(`${API_URL}/demo/bot-status`);
  },

  resetSale(countdownSeconds: number = 30, stock: number = 100) {
    return fetchJson(`${API_URL}/demo/reset`, {
      method: "POST",
      body: JSON.stringify({ countdown_seconds: countdownSeconds, stock }),
    });
  },

  launchChaos(numBots: number = 50000) {
    return fetchJson(`${API_URL}/demo/chaos`, {
      method: "POST",
      body: JSON.stringify({ num_bots: numBots, stagger: 0.01 }),
    });
  },
};
