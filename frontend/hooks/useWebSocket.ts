"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StockState {
  stock: number | null;
  event: string | null;
  connected: boolean;
}

export function useWebSocket(productId: string): StockState {
  const [state, setState] = useState<StockState>({
    stock: null,
    event: null,
    connected: false,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(`${WS_URL}/ws/stock?product_id=${productId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, connected: true }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setState({
          stock: data.stock,
          event: data.event,
          connected: true,
        });
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, connected: false }));
      // Reconnect after 2 seconds
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [productId]);

  // Fetch initial stock via REST
  useEffect(() => {
    fetch(`${API_URL}/inventory/${productId}`)
      .then((r) => r.json())
      .then((data) => {
        setState((prev) => ({ ...prev, stock: data.stock }));
      })
      .catch(() => {});
  }, [productId]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [connect]);

  return state;
}
