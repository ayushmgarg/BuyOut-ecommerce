"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { DashboardMetrics, TimeSeriesPoint } from "@/lib/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

interface DashboardState {
  metrics: DashboardMetrics | null;
  connected: boolean;
  initialHistory: TimeSeriesPoint[] | null;
}

export function useDashboardWebSocket(): DashboardState {
  const [state, setState] = useState<DashboardState>({
    metrics: null,
    connected: false,
    initialHistory: null,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(`${WS_URL}/ws/dashboard`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, connected: true }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle bootstrap history message
        if (data.type === "history" && Array.isArray(data.time_series)) {
          setState((prev) => ({
            ...prev,
            initialHistory: data.time_series as TimeSeriesPoint[],
          }));
          return;
        }

        // Normal metrics message
        setState((prev) => ({
          ...prev,
          metrics: data as DashboardMetrics,
          connected: true,
        }));
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, connected: false }));
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

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
