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

export interface DashboardMetrics {
  stock: number;
  confirmed_orders: number;
  queue_depth: number;
  sold_out_count: number;
  active_reservations: number;
  throughput_rps: number;
  worker_count: number;
  worker_states: WorkerState[];
  events: TransactionEvent[];
  timestamp: number;
}

export interface WorkerState {
  id: string;
  state: "idle" | "processing" | "overloaded";
}

export interface TransactionEvent {
  type: string;
  user_id: string;
  timestamp: number;
  status: "success" | "failed" | "compensated";
  reservation_id?: string;
}
