"use client";

import { useState, useEffect, useRef } from "react";
import { useSpring, useTransform } from "framer-motion";

interface DashboardHeaderProps {
  connected: boolean;
  totalEvents: number;
  firstTimestamp: number | null;
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) =>
    Math.round(v).toLocaleString()
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

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function DashboardHeader({
  connected,
  totalEvents,
  firstTimestamp,
}: DashboardHeaderProps) {
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    if (firstTimestamp === null) {
      setElapsed("00:00");
      return;
    }

    const update = () => {
      const now = Date.now() / 1000;
      const diff = Math.max(0, now - firstTimestamp);
      setElapsed(formatElapsed(diff));
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [firstTimestamp]);

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-midnight-900/80 border border-midnight-700/30 rounded-xl">
      <div>
        <h1 className="text-sm font-bold uppercase tracking-widest text-white">
          Observer Dashboard
        </h1>
        <p className="text-[10px] text-midnight-100/40">
          Midnight Product Drop
        </p>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-2xl font-mono font-bold text-white tabular-nums">
          {elapsed}
        </span>
        <span className="text-[10px] text-midnight-100/30 uppercase tracking-wider">
          Elapsed
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="text-sm font-mono font-bold text-white">
            <AnimatedNumber value={totalEvents} />
          </span>
          <span className="text-[10px] text-midnight-100/30 uppercase tracking-wider">
            Events
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-green-400 animate-pulse" : "bg-red-400"
            }`}
          />
          <span
            className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
              connected ? "text-green-400" : "text-red-400"
            }`}
          >
            {connected ? "LIVE" : "DISCONNECTED"}
          </span>
        </div>
      </div>
    </div>
  );
}
