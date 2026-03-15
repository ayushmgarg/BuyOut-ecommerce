"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { TimeSeriesPoint } from "@/lib/types";

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  dataKey: string;
  color: string;
  title: string;
  currentValue: number;
  unit?: string;
  gradientId: string;
  referenceValue?: number;
  referenceLabel?: string;
}

function formatRelativeTime(timestamp: number, latestTimestamp: number): string {
  const diffSeconds = latestTimestamp - timestamp;

  if (diffSeconds <= 5) return "now";
  if (diffSeconds < 60) return `${Math.round(diffSeconds)}s`;
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m`;
}

function formatTooltipTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: number;
  unit?: string;
}

function CustomTooltip({ active, payload, label, unit }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || label === undefined) {
    return null;
  }

  return (
    <div className="bg-midnight-950/95 border border-midnight-700/50 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] font-mono text-midnight-100/50 mb-1">
        {formatTooltipTime(label)}
      </p>
      <p className="text-sm font-mono font-bold text-white">
        {typeof payload[0].value === "number"
          ? payload[0].value.toLocaleString(undefined, { maximumFractionDigits: 1 })
          : payload[0].value}
        {unit && (
          <span className="text-midnight-100/50 text-xs ml-1">{unit}</span>
        )}
      </p>
    </div>
  );
}

function TimeSeriesChartInner({
  data,
  dataKey,
  color,
  title,
  currentValue,
  unit,
  gradientId,
  referenceValue,
  referenceLabel,
}: TimeSeriesChartProps) {
  const latestTimestamp = useMemo(() => {
    if (data.length === 0) return 0;
    return data[data.length - 1].t;
  }, [data]);

  const yDomain = useMemo(() => {
    if (data.length === 0) return [0, 100];
    const values = data.map((d) => (d as unknown as Record<string, number>)[dataKey] ?? 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    // Scale padding proportionally — avoid fixed minimums that dwarf small data
    const padding = Math.max(range * 0.2, max * 0.15, 1);
    return [Math.max(0, Math.floor(min - padding * 0.1)), Math.ceil(max + padding)];
  }, [data, dataKey]);

  return (
    <div className="bg-midnight-900/80 border border-midnight-700/30 rounded-xl p-4 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-midnight-100/50">
          {title}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-mono font-bold text-white">
            {typeof currentValue === "number"
              ? currentValue.toLocaleString(undefined, { maximumFractionDigits: 1 })
              : currentValue}
          </span>
          {unit && (
            <span className="text-xs text-midnight-100/40">{unit}</span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
            style={{ overflow: "hidden" }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(107,92,231,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="t"
              tickFormatter={(ts: number) =>
                formatRelativeTime(ts, latestTimestamp)
              }
              tick={{ fill: "rgba(255,255,255,0.4)", fontFamily: "monospace", fontSize: 10 }}
              axisLine={{ stroke: "rgba(107,92,231,0.1)" }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={yDomain}
              allowDataOverflow={true}
              tick={{ fill: "rgba(255,255,255,0.4)", fontFamily: "monospace", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
              }
            />
            <Tooltip
              content={<CustomTooltip unit={unit} />}
              cursor={{ stroke: "rgba(107,92,231,0.2)" }}
            />
            {referenceValue !== undefined && (
              <ReferenceLine
                y={referenceValue}
                stroke="rgba(248,113,113,0.5)"
                strokeDasharray="4 4"
                label={{
                  value: referenceLabel ?? "",
                  position: "right",
                  fill: "rgba(248,113,113,0.6)",
                  fontSize: 10,
                  fontFamily: "monospace",
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              baseValue={yDomain[0] as number}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const TimeSeriesChart = React.memo(TimeSeriesChartInner);
export default TimeSeriesChart;
