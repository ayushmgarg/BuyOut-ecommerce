"use client";

import { useEffect, useRef } from "react";
import { useSpring, useTransform } from "framer-motion";
import { useDashboardWebSocket } from "@/hooks/useDashboardWebSocket";

function AnimatedNumber({
  value,
  decimals = 0,
}: {
  value: number;
  decimals?: number;
}) {
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

function Metric({
  label,
  value,
  suffix,
  colorClass,
}: {
  label: string;
  value: number;
  suffix?: string;
  colorClass: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] uppercase tracking-widest text-midnight-100/40">
        {label}
      </span>
      <span className={`text-xl font-mono font-bold ${colorClass}`}>
        <AnimatedNumber value={value} decimals={suffix === "req/s" ? 1 : 0} />
        {suffix && (
          <span className="text-xs font-normal ml-1 opacity-60">
            {suffix}
          </span>
        )}
      </span>
    </div>
  );
}

function VerticalDivider() {
  return <div className="w-px h-8 bg-white/[0.06] self-center" />;
}

function ConnectionDot({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 animate-ping" />
        </div>
        <span className="text-[10px] uppercase tracking-widest text-green-500/70">
          Live
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full bg-red-500/60" />
      <span className="text-[10px] uppercase tracking-widest text-red-400/50">
        Offline
      </span>
    </div>
  );
}

export default function LiveStatsBar() {
  const { metrics, connected } = useDashboardWebSocket();

  const stock = metrics?.stock ?? 0;
  const queueDepth = metrics?.queue_depth ?? 0;
  const throughput = metrics?.throughput_rps ?? 0;

  const stockColor = stock > 0 ? "text-green-400" : "text-red-400";
  const queueColor = queueDepth > 100 ? "text-amber-400" : "text-midnight-100/80";
  const throughputColor = "text-cyan-400";

  return (
    <div className="w-full bg-white/[0.02] border border-white/[0.06] px-8 py-4">
      <div className="flex items-center justify-center gap-6">
        <ConnectionDot connected={connected} />
        <VerticalDivider />
        <Metric
          label="Stock"
          value={stock}
          colorClass={stockColor}
        />
        <VerticalDivider />
        <Metric
          label="Queue"
          value={queueDepth}
          colorClass={queueColor}
        />
        <VerticalDivider />
        <Metric
          label="Throughput"
          value={throughput}
          suffix="req/s"
          colorClass={throughputColor}
        />
      </div>
    </div>
  );
}
