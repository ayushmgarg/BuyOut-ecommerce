"use client";

import { useMemo } from "react";
import { useTimeSeriesBuffer } from "@/hooks/useTimeSeriesBuffer";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import MetricCardSpark from "@/components/dashboard/MetricCardSpark";
import TimeSeriesChart from "@/components/dashboard/TimeSeriesChart";
import QueueVisualization from "@/components/dashboard/QueueVisualization";
import EventLog from "@/components/dashboard/EventLog";
import TransactionFlow from "@/components/dashboard/TransactionFlow";
import ChaosButton from "@/components/dashboard/ChaosButton";

export default function DashboardContent() {
  const { metrics, connected, timeSeries, recentEvents } =
    useTimeSeriesBuffer();

  // Extract sparkline data (last 30 points) for metric cards
  const sparkWindow = useMemo(() => {
    const recent = timeSeries.slice(-30);
    return {
      stock: recent.map((p) => p.stock),
      orders: recent.map((p) => p.orders),
      queue: recent.map((p) => p.totalJoined),
      soldOut: recent.map((p) => p.soldOut),
      throughput: recent.map((p) => p.throughput),
    };
  }, [timeSeries]);

  // Compute deltas (change over last 5 seconds = last 5 points)
  const deltas = useMemo(() => {
    if (timeSeries.length < 6) {
      return { stock: 0, orders: 0, queue: 0, soldOut: 0, throughput: 0 };
    }
    const now = timeSeries[timeSeries.length - 1];
    const then = timeSeries[timeSeries.length - 6];
    return {
      stock: now.stock - then.stock,
      orders: now.orders - then.orders,
      queue: now.totalJoined - then.totalJoined,
      soldOut: now.soldOut - then.soldOut,
      throughput: Math.round((now.throughput - then.throughput) * 10) / 10,
    };
  }, [timeSeries]);

  // First timestamp for elapsed timer
  const firstTimestamp = useMemo(() => {
    if (timeSeries.length === 0) return null;
    return timeSeries[0].t;
  }, [timeSeries]);

  const stock = metrics?.stock ?? 0;
  const orders = metrics?.confirmed_orders ?? 0;
  const totalJoined = metrics?.total_joined ?? 0;
  const soldOut = metrics?.sold_out_count ?? 0;
  const throughput = metrics?.throughput_rps ?? 0;

  return (
    <div className="h-screen flex flex-col p-3 gap-3 overflow-hidden bg-midnight-950">
      {/* Row 0: Header */}
      <DashboardHeader
        connected={connected}
        totalEvents={recentEvents.length}
        firstTimestamp={firstTimestamp}
      />

      {/* Row 1: Metric Cards + Chaos */}
      <div className="flex gap-3 flex-shrink-0">
        <div className="flex-1 grid grid-cols-5 gap-3">
          <MetricCardSpark
            label="Stock"
            value={stock}
            sparkData={sparkWindow.stock}
            color={stock > 0 ? "#4ade80" : "#f87171"}
            borderColor={
              stock > 0 ? "border-green-500/30" : "border-red-500/40"
            }
            glowColor={
              stock > 0
                ? "rgba(74, 222, 128, 0.3)"
                : "rgba(248, 113, 113, 0.4)"
            }
            delta={deltas.stock}
          />
          <MetricCardSpark
            label="Orders"
            value={orders}
            sparkData={sparkWindow.orders}
            color="#4ade80"
            borderColor="border-green-500/20"
            glowColor="rgba(74, 222, 128, 0.25)"
            delta={deltas.orders}
          />
          <MetricCardSpark
            label="Total Joined"
            value={totalJoined}
            sparkData={sparkWindow.queue}
            color={totalJoined > 1000 ? "#f87171" : "#fbbf24"}
            borderColor={
              totalJoined > 1000 ? "border-red-500/30" : "border-amber-500/30"
            }
            glowColor={
              totalJoined > 1000
                ? "rgba(248, 113, 113, 0.3)"
                : "rgba(251, 191, 36, 0.3)"
            }
            delta={deltas.queue}
          />
          <MetricCardSpark
            label="Sold Out"
            value={soldOut}
            sparkData={sparkWindow.soldOut}
            color="#f87171"
            borderColor="border-red-500/30"
            glowColor="rgba(248, 113, 113, 0.3)"
            delta={deltas.soldOut}
          />
          <MetricCardSpark
            label="Throughput"
            value={throughput}
            sparkData={sparkWindow.throughput}
            color="#22d3ee"
            borderColor="border-cyan-500/30"
            glowColor="rgba(34, 211, 238, 0.3)"
            unit="req/s"
            decimals={1}
            delta={deltas.throughput}
          />
        </div>
        <div className="w-56 flex-shrink-0">
          <ChaosButton />
        </div>
      </div>

      {/* Row 2: Primary Charts (3 columns) */}
      <div className="grid grid-cols-3 gap-3 flex-1 min-h-0 overflow-hidden">
        <TimeSeriesChart
          data={timeSeries}
          dataKey="stock"
          color="#4ade80"
          title="Stock Depletion"
          currentValue={stock}
          gradientId="grad-stock"
          referenceValue={0}
          referenceLabel="SOLD OUT"
        />
        <TimeSeriesChart
          data={timeSeries}
          dataKey="throughput"
          color="#22d3ee"
          title="Throughput"
          currentValue={throughput}
          unit="req/s"
          gradientId="grad-throughput"
        />
        <TimeSeriesChart
          data={timeSeries}
          dataKey="totalJoined"
          color="#fbbf24"
          title="Total Joined"
          currentValue={totalJoined}
          gradientId="grad-queue"
        />
      </div>

      {/* Row 3: Orders Chart + Queue Flow + Event Log */}
      <div className="grid grid-cols-3 gap-3 flex-1 min-h-0 overflow-hidden">
        <TimeSeriesChart
          data={timeSeries}
          dataKey="orders"
          color="#a78bfa"
          title="Orders"
          currentValue={orders}
          gradientId="grad-orders"
        />
        <QueueVisualization queueDepth={totalJoined} />
        <EventLog events={recentEvents} />
      </div>

      {/* Row 4: Transaction Flow */}
      <div className="flex-shrink-0">
        <TransactionFlow events={metrics?.events ?? []} />
      </div>
    </div>
  );
}
