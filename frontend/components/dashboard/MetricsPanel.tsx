"use client";

import { useEffect, useRef } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import type { DashboardMetrics } from "@/lib/types";

interface MetricsPanelProps {
  metrics: DashboardMetrics | null;
}

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const spring = useSpring(0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) =>
    decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()
  );
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    return display.on("change", (v) => {
      if (ref.current) ref.current.textContent = v;
    });
  }, [display]);

  return <span ref={ref}>0</span>;
}

interface CardProps {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  glowColor: string;
  borderColor: string;
}

function MetricCard({ label, value, suffix, decimals, glowColor, borderColor }: CardProps) {
  return (
    <motion.div
      className={`bg-midnight-900/80 border rounded-xl p-4 flex flex-col gap-1 ${borderColor}`}
      animate={{
        boxShadow: value > 0 ? `0 0 20px ${glowColor}` : "0 0 0px transparent",
      }}
      transition={{ duration: 0.5 }}
    >
      <span className="text-xs uppercase tracking-widest text-midnight-100/50">
        {label}
      </span>
      <span className="text-2xl font-mono font-bold text-white">
        <AnimatedNumber value={value} decimals={decimals} />
        {suffix && <span className="text-sm text-midnight-100/60 ml-1">{suffix}</span>}
      </span>
    </motion.div>
  );
}

export default function MetricsPanel({ metrics }: MetricsPanelProps) {
  const stock = metrics?.stock ?? 0;
  const orders = metrics?.confirmed_orders ?? 0;
  const queue = metrics?.queue_depth ?? 0;
  const soldOut = metrics?.sold_out_count ?? 0;
  const throughput = metrics?.throughput_rps ?? 0;

  return (
    <div className="grid grid-cols-5 gap-3">
      <MetricCard
        label="Stock"
        value={stock}
        glowColor={stock > 0 ? "rgba(74, 222, 128, 0.3)" : "rgba(248, 113, 113, 0.4)"}
        borderColor={stock > 0 ? "border-green-500/30" : "border-red-500/40"}
      />
      <MetricCard
        label="Orders"
        value={orders}
        glowColor="rgba(74, 222, 128, 0.25)"
        borderColor="border-green-500/20"
      />
      <MetricCard
        label="Queue Depth"
        value={queue}
        glowColor={queue > 1000 ? "rgba(248, 113, 113, 0.3)" : "rgba(251, 191, 36, 0.3)"}
        borderColor={queue > 1000 ? "border-red-500/30" : "border-amber-500/30"}
      />
      <MetricCard
        label="Sold Out"
        value={soldOut}
        glowColor="rgba(248, 113, 113, 0.3)"
        borderColor="border-red-500/30"
      />
      <MetricCard
        label="Throughput"
        value={throughput}
        suffix="req/s"
        decimals={1}
        glowColor="rgba(34, 211, 238, 0.3)"
        borderColor="border-cyan-500/30"
      />
    </div>
  );
}
