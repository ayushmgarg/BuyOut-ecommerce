"use client";

import { useState, useEffect, useRef } from "react";

interface CountdownTimerProps {
  targetTime: Date;
  onComplete: () => void;
}

export default function CountdownTimer({ targetTime, onComplete }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const diff = targetTime.getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;

    const timer = setInterval(() => {
      const diff = targetTime.getTime() - Date.now();
      const seconds = Math.max(0, Math.floor(diff / 1000));
      setTimeLeft(seconds);

      if (seconds <= 0 && !completedRef.current) {
        completedRef.current = true;
        clearInterval(timer);
        onComplete();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTime, onComplete]);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="text-center">
      <p className="text-midnight-100/60 mb-4 uppercase tracking-widest text-sm">
        Drop starts in
      </p>
      <div className="flex gap-4 text-6xl font-mono font-bold tabular-nums">
        <span>{pad(hours)}</span>
        <span className="text-midnight-500">:</span>
        <span>{pad(minutes)}</span>
        <span className="text-midnight-500">:</span>
        <span>{pad(seconds)}</span>
      </div>
    </div>
  );
}
