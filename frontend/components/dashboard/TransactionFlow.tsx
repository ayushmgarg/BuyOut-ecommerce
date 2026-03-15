"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, CreditCard, HardDrive, CheckCircle2 } from "lucide-react";
import type { TransactionEvent } from "@/lib/types";

interface TransactionFlowProps {
  events: TransactionEvent[];
}

const stages = [
  { icon: Database, label: "Redis DECRBY", sublabel: "Atomic Lock" },
  { icon: CreditCard, label: "Payment Gateway", sublabel: "Async Charge" },
  { icon: HardDrive, label: "PostgreSQL INSERT", sublabel: "Order Record" },
  { icon: CheckCircle2, label: "Final Sync", sublabel: "Confirmation" },
];

type StageState = "waiting" | "active" | "success" | "failed";

const stageColors: Record<StageState, { border: string; bg: string; glow: string; icon: string }> = {
  waiting: {
    border: "border-midnight-700/40",
    bg: "bg-midnight-900/60",
    glow: "0 0 0px transparent",
    icon: "text-midnight-100/30",
  },
  active: {
    border: "border-midnight-500/60",
    bg: "bg-midnight-900/80",
    glow: "0 0 20px rgba(107, 92, 231, 0.4)",
    icon: "text-midnight-500",
  },
  success: {
    border: "border-green-500/50",
    bg: "bg-green-950/30",
    glow: "0 0 15px rgba(74, 222, 128, 0.3)",
    icon: "text-green-400",
  },
  failed: {
    border: "border-red-500/50",
    bg: "bg-red-950/30",
    glow: "0 0 15px rgba(248, 113, 113, 0.3)",
    icon: "text-red-400",
  },
};

export default function TransactionFlow({ events }: TransactionFlowProps) {
  const [stageStates, setStageStates] = useState<StageState[]>(
    stages.map(() => "waiting")
  );
  const [currentEvent, setCurrentEvent] = useState<TransactionEvent | null>(null);
  const [showRollback, setShowRollback] = useState(false);
  const [packetPosition, setPacketPosition] = useState(-1);
  const timeoutRef = useRef<NodeJS.Timeout[]>([]);
  const lastEventRef = useRef<string>("");

  useEffect(() => {
    if (events.length === 0) return;

    const latest = events[events.length - 1];
    const eventKey = `${latest.user_id}_${latest.timestamp}`;
    if (eventKey === lastEventRef.current) return;
    lastEventRef.current = eventKey;

    // Clear previous animation
    timeoutRef.current.forEach(clearTimeout);
    timeoutRef.current = [];
    setShowRollback(false);
    setPacketPosition(-1);
    setStageStates(stages.map(() => "waiting"));
    setCurrentEvent(latest);

    const isSuccess = latest.status === "success";

    // Animate stages sequentially
    const stageCount = isSuccess ? 4 : 2;
    for (let i = 0; i < stageCount; i++) {
      // Activate stage
      const activateTimer = setTimeout(() => {
        setPacketPosition(i);
        setStageStates((prev) => {
          const next = [...prev];
          next[i] = "active";
          return next;
        });
      }, i * 400);
      timeoutRef.current.push(activateTimer);

      // Complete stage
      const completeTimer = setTimeout(() => {
        setStageStates((prev) => {
          const next = [...prev];
          next[i] = "success";
          return next;
        });
      }, i * 400 + 300);
      timeoutRef.current.push(completeTimer);
    }

    if (!isSuccess) {
      // Show failure at stage 3
      const failTimer = setTimeout(() => {
        setStageStates((prev) => {
          const next = [...prev];
          next[2] = "failed";
          return next;
        });
        setShowRollback(true);
        setPacketPosition(-1);
      }, stageCount * 400 + 200);
      timeoutRef.current.push(failTimer);

      // Rollback: reverse stages
      const rollbackTimer = setTimeout(() => {
        setStageStates((prev) => {
          const next = [...prev];
          next[0] = "failed";
          next[1] = "failed";
          return next;
        });
      }, stageCount * 400 + 800);
      timeoutRef.current.push(rollbackTimer);
    }

    // Reset after animation
    const resetTimer = setTimeout(() => {
      setStageStates(stages.map(() => "waiting"));
      setCurrentEvent(null);
      setShowRollback(false);
      setPacketPosition(-1);
      lastEventRef.current = "";
    }, isSuccess ? 3000 : 3500);
    timeoutRef.current.push(resetTimer);

    return () => {
      timeoutRef.current.forEach(clearTimeout);
    };
  }, [events]);

  return (
    <div className="bg-midnight-900/80 border border-midnight-700/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-midnight-100/50">
          Atomic Gate — Transaction Flow
        </span>
        {currentEvent && (
          <span className="text-xs font-mono text-midnight-100/40">
            {currentEvent.user_id}
            {currentEvent.reservation_id
              ? ` • ${currentEvent.reservation_id.slice(0, 8)}...`
              : ""}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {stages.map((stage, i) => {
          const state = stageStates[i];
          const colors = stageColors[state];
          const Icon = stage.icon;

          return (
            <div key={stage.label} className="flex items-center flex-1">
              <motion.div
                className={`flex-1 border rounded-lg p-3 flex items-center gap-3 ${colors.border} ${colors.bg}`}
                animate={{ boxShadow: colors.glow }}
                transition={{ duration: 0.3 }}
              >
                <Icon size={20} className={colors.icon} />
                <div>
                  <p className="text-xs font-bold text-white/80">{stage.label}</p>
                  <p className="text-[10px] text-midnight-100/40">{stage.sublabel}</p>
                </div>
              </motion.div>

              {/* Connector */}
              {i < stages.length - 1 && (
                <div className="w-6 flex items-center justify-center relative">
                  <div className="w-full h-px bg-midnight-700/40" />
                  <AnimatePresence>
                    {packetPosition === i && (
                      <motion.div
                        className="absolute w-2 h-2 rounded-full bg-midnight-500"
                        initial={{ x: -8, opacity: 0 }}
                        animate={{ x: 8, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ boxShadow: "0 0 8px rgba(107, 92, 231, 0.6)" }}
                      />
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showRollback && (
          <motion.div
            className="mt-2 text-center"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
              Compensation Rollback — Stock Restored
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
