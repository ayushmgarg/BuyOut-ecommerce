"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDashboardWebSocket } from "./useDashboardWebSocket";
import type { TimeSeriesPoint, TransactionEvent } from "@/lib/types";

const MAX_TIMESERIES = 300; // 5 min at 1 point/sec
const MAX_EVENTS = 200;
const DOWNSAMPLE_INTERVAL = 1.0; // seconds between data points
const STATE_UPDATE_INTERVAL = 500; // ms between React state updates

interface TimeSeriesState {
  timeSeries: TimeSeriesPoint[];
  recentEvents: TransactionEvent[];
}

export function useTimeSeriesBuffer() {
  const { metrics, connected, initialHistory } = useDashboardWebSocket();

  const [tsState, setTsState] = useState<TimeSeriesState>({
    timeSeries: [],
    recentEvents: [],
  });

  // Mutable buffers (no React re-renders on each WS message)
  const tsBufferRef = useRef<TimeSeriesPoint[]>([]);
  const eventsBufferRef = useRef<TransactionEvent[]>([]);
  const lastRecordedTimeRef = useRef(0);
  const lastEventKeyRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);

  // Seed from backend bootstrap history (one-shot)
  useEffect(() => {
    if (initialHistory && initialHistory.length > 0 && !seededRef.current) {
      tsBufferRef.current = initialHistory.slice(-MAX_TIMESERIES);
      seededRef.current = true;
      if (initialHistory.length > 0) {
        lastRecordedTimeRef.current =
          initialHistory[initialHistory.length - 1].t;
      }
    }
  }, [initialHistory]);

  // Accumulate metrics into the ring buffer
  useEffect(() => {
    if (!metrics) return;

    const now = metrics.timestamp;

    // Downsample: only record 1 point per second
    if (now - lastRecordedTimeRef.current >= DOWNSAMPLE_INTERVAL) {
      const point: TimeSeriesPoint = {
        t: now,
        stock: metrics.stock,
        orders: metrics.confirmed_orders,
        queueDepth: metrics.queue_depth,
        totalJoined: metrics.total_joined ?? 0,
        soldOut: metrics.sold_out_count,
        throughput: metrics.throughput_rps,
        activeReservations: metrics.active_reservations,
      };

      const buf = tsBufferRef.current;
      if (buf.length >= MAX_TIMESERIES) {
        buf.shift();
      }
      buf.push(point);
      lastRecordedTimeRef.current = now;
    }

    // Deduplicate and accumulate events
    if (metrics.events && metrics.events.length > 0) {
      const newEvents: TransactionEvent[] = [];
      for (const evt of metrics.events) {
        const key = `${evt.user_id}_${evt.timestamp}_${evt.type}`;
        if (!lastEventKeyRef.current.has(key)) {
          lastEventKeyRef.current.add(key);
          newEvents.push(evt);
        }
      }
      if (newEvents.length > 0) {
        const buf = eventsBufferRef.current;
        buf.push(...newEvents);
        // Trim to max
        if (buf.length > MAX_EVENTS) {
          const excess = buf.length - MAX_EVENTS;
          buf.splice(0, excess);
          // Also trim the dedup set to prevent unbounded growth
          const keysToKeep = new Set(
            buf.map((e) => `${e.user_id}_${e.timestamp}_${e.type}`)
          );
          lastEventKeyRef.current = keysToKeep;
        }
      }
    }
  }, [metrics]);

  // Throttled state update — copy buffers to React state at fixed interval
  useEffect(() => {
    const interval = setInterval(() => {
      setTsState({
        timeSeries: [...tsBufferRef.current],
        recentEvents: [...eventsBufferRef.current],
      });
    }, STATE_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Reset buffers when sale is reset (stock jumps back up)
  const prevStockRef = useRef<number | null>(null);
  useEffect(() => {
    if (!metrics) return;
    if (
      prevStockRef.current !== null &&
      metrics.stock > prevStockRef.current + 10
    ) {
      // Stock jumped up significantly — sale was reset
      tsBufferRef.current = [];
      eventsBufferRef.current = [];
      lastEventKeyRef.current.clear();
      lastRecordedTimeRef.current = 0;
      seededRef.current = false;
    }
    prevStockRef.current = metrics.stock;
  }, [metrics]);

  return {
    metrics,
    connected,
    timeSeries: tsState.timeSeries,
    recentEvents: tsState.recentEvents,
  };
}
