export interface WaitingRoomPosition {
  status: "waiting" | "ready" | "not_joined";
  position: number | null;
  estimated_wait_seconds: number | null;
  token: string | null;
}

export interface ReserveResult {
  status: "reserved" | "user_limit_exceeded" | "out_of_stock";
  reservation_id: string | null;
  expires_at: string | null;
  message: string | null;
}

export interface PaymentIntent {
  client_secret: string;
  payment_intent_id: string;
  amount_cents: number;
  currency: string;
}

export interface Inventory {
  product_id: string;
  stock: number;
  sale_active: boolean;
}

export interface StockUpdate {
  product_id: string;
  stock: number;
  event: "reserved" | "confirmed" | "released" | "sold_out";
  timestamp: string;
}
