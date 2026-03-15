"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { WorkerState } from "@/lib/types";

interface WorkerGridProps {
  workerCount: number;
  workerStates: WorkerState[];
}

const stateStyles: Record<string, { bg: string; border: string; pulse: boolean }> = {
  idle: {
    bg: "bg-green-500/30",
    border: "border-green-500/50",
    pulse: true,
  },
  processing: {
    bg: "bg-amber-500/50",
    border: "border-amber-500/70",
    pulse: false,
  },
  overloaded: {
    bg: "bg-red-500/60",
    border: "border-red-500/80",
    pulse: true,
  },
};

export default function WorkerGrid({ workerCount, workerStates }: WorkerGridProps) {
  const workers = workerStates.length > 0
    ? workerStates.slice(0, 128)
    : Array.from({ length: Math.min(workerCount, 128) }, (_, i) => ({
        id: `worker_${i}`,
        state: "idle" as const,
      }));

  return (
    <div className="bg-midnight-900/80 border border-midnight-700/30 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-midnight-100/50">
          Worker Pool
        </span>
        <span className="text-xs font-mono text-midnight-100/40">
          {workerCount} active
        </span>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex flex-wrap gap-1 content-start">
          <AnimatePresence>
            {workers.map((worker, i) => {
              const style = stateStyles[worker.state] || stateStyles.idle;
              return (
                <motion.div
                  key={worker.id}
                  className={`w-4 h-4 rounded-sm border ${style.bg} ${style.border}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: 1,
                    opacity: style.pulse ? [0.5, 1, 0.5] : 1,
                  }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{
                    scale: { delay: i * 0.015, duration: 0.3 },
                    opacity: style.pulse
                      ? {
                          duration: worker.state === "overloaded" ? 0.5 : 2,
                          repeat: Infinity,
                        }
                      : { duration: 0.3 },
                  }}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-2 flex gap-3 text-[10px] text-midnight-100/40">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-green-500/40 border border-green-500/60" /> Idle
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-amber-500/50 border border-amber-500/70" /> Active
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-red-500/60 border border-red-500/80" /> Overloaded
        </span>
      </div>
    </div>
  );
}
