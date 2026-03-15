"use client";

import { useDashboardWebSocket } from "@/hooks/useDashboardWebSocket";
import MetricsPanel from "@/components/dashboard/MetricsPanel";
import QueueVisualization from "@/components/dashboard/QueueVisualization";
import WorkerGrid from "@/components/dashboard/WorkerGrid";
import TransactionFlow from "@/components/dashboard/TransactionFlow";
import ChaosButton from "@/components/dashboard/ChaosButton";

export default function DashboardContent() {
  const { metrics, connected } = useDashboardWebSocket();

  return (
    <div className="h-screen flex flex-col p-4 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">
            OBSERVER DASHBOARD
          </h1>
          <span className="text-xs uppercase tracking-widest text-midnight-100/40">
            Midnight Product Drop
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <span className="text-xs text-midnight-100/50">
            {connected ? "LIVE" : "DISCONNECTED"}
          </span>
        </div>
      </div>

      {/* Row 1: Metrics + Chaos */}
      <div className="flex gap-4 flex-shrink-0">
        <div className="flex-1">
          <MetricsPanel metrics={metrics} />
        </div>
        <div className="w-64 flex-shrink-0">
          <ChaosButton />
        </div>
      </div>

      {/* Row 2: Queue + Workers */}
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <QueueVisualization queueDepth={metrics?.queue_depth ?? 0} />
        </div>
        <div className="w-80 flex-shrink-0">
          <WorkerGrid
            workerCount={metrics?.worker_count ?? 2}
            workerStates={metrics?.worker_states ?? []}
          />
        </div>
      </div>

      {/* Row 3: Transaction Flow */}
      <div className="flex-shrink-0">
        <TransactionFlow events={metrics?.events ?? []} />
      </div>
    </div>
  );
}
