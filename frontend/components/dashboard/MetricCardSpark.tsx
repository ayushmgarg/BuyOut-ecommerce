"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { AreaChart, Area, YAxis, ResponsiveContainer } from "recharts";

interface MetricCardSparkProps {
  label: string;
  value: number;
  sparkData: number[];
  color: string;
  borderColor: string;
  glowColor: string;
  unit?: string;
  decimals?: number;
  delta?: number;
}

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

function DeltaIndicator({ delta }: { delta?: number }) {
  if (delta === undefined || delta === 0) {
    return (
      <span className="text-[10px] font-mono text-midnight-100/30">
        &mdash;
      </span>
    );
  }

  const isPositive = delta > 0;
  const colorClass = isPositive ? "text-green-400" : "text-red-400";
  const arrow = isPositive ? "\u25B2" : "\u25BC";

  return (
    <span className={`text-[10px] font-mono ${colorClass} flex items-center gap-0.5`}>
      <span>{arrow}</span>
      <span>{Math.abs(delta).toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
    </span>
  );
}

function MetricCardSparkInner({
  label,
  value,
  sparkData,
  color,
  borderColor,
  glowColor,
  unit,
  decimals = 0,
  delta,
}: MetricCardSparkProps) {
  const chartData = (sparkData.length > 0 ? sparkData : [0]).map((v, i) => ({ i, v }));

  const sparkDomain = useMemo(() => {
    if (sparkData.length === 0) return [0, 1];
    const max = Math.max(...sparkData);
    const min = Math.min(...sparkData);
    if (max === min) return [0, Math.max(max * 1.5, 1)];
    const padding = (max - min) * 0.2;
    return [Math.max(0, min - padding), max + padding];
  }, [sparkData]);

  return (
    <motion.div
      className={`bg-midnight-900/80 border rounded-xl p-4 flex flex-col gap-2 ${borderColor}`}
      animate={{
        boxShadow:
          value > 0 ? `0 0 20px ${glowColor}` : "0 0 0px transparent",
      }}
      transition={{ duration: 0.5 }}
    >
      <span className="text-xs uppercase tracking-widest text-midnight-100/50">
        {label}
      </span>

      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-mono font-bold text-white">
            <AnimatedNumber value={value} decimals={decimals} />
          </span>
          {unit && (
            <span className="text-sm text-midnight-100/60">{unit}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <DeltaIndicator delta={delta} />
          <div className="w-[60px] h-[24px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient
                    id={`spark-${label.replace(/\s+/g, "-")}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={sparkDomain} />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={color}
                  strokeWidth={1}
                  fill={`url(#spark-${label.replace(/\s+/g, "-")})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const MetricCardSpark = React.memo(MetricCardSparkInner);
export default MetricCardSpark;
