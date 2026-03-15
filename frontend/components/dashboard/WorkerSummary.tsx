"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { WorkerState } from "@/lib/types";

interface WorkerSummaryProps {
  workerStates: WorkerState[];
  workerCount: number;
}

interface BarSegment {
  label: string;
  count: number;
  percentage: number;
  colorBg: string;
  colorText: string;
}

export default function WorkerSummary({
  workerStates,
  workerCount,
}: WorkerSummaryProps) {
  const segments = useMemo((): BarSegment[] => {
    const total = workerCount || workerStates.length || 1;
    const idleCount = workerStates.filter((w) => w.state === "idle").length;
    const processingCount = workerStates.filter(
      (w) => w.state === "processing"
    ).length;
    const overloadedCount = workerStates.filter(
      (w) => w.state === "overloaded"
    ).length;

    return [
      {
        label: "Idle",
        count: idleCount,
        percentage: (idleCount / total) * 100,
        colorBg: "bg-green-500",
        colorText: "text-green-400",
      },
      {
        label: "Processing",
        count: processingCount,
        percentage: (processingCount / total) * 100,
        colorBg: "bg-amber-500",
        colorText: "text-amber-400",
      },
      {
        label: "Overloaded",
        count: overloadedCount,
        percentage: (overloadedCount / total) * 100,
        colorBg: "bg-red-500",
        colorText: "text-red-400",
      },
    ];
  }, [workerStates, workerCount]);

  return (
    <div className="bg-midnight-900/80 border border-midnight-700/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-midnight-100/50">
          Workers
        </span>
        <span className="text-xs font-mono text-midnight-100/40">
          {workerCount} total
        </span>
      </div>

      <div className="space-y-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono w-[72px] shrink-0 ${segment.colorText}`}
            >
              {segment.label}
            </span>
            <div className="flex-1 h-3 bg-midnight-800/60 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${segment.colorBg}`}
                initial={{ width: 0 }}
                animate={{ width: `${segment.percentage}%` }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                style={{ opacity: 0.7 }}
              />
            </div>
            <span className="text-[10px] font-mono text-midnight-100/50 w-[28px] text-right shrink-0">
              {segment.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
