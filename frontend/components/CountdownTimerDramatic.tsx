"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface CountdownTimerDramaticProps {
  targetTime: Date;
  onComplete: () => void;
}

function splitDigits(value: number): [string, string] {
  const padded = String(value).padStart(2, "0");
  return [padded[0], padded[1]];
}

function DigitCard({
  digit,
  urgent,
  critical,
}: {
  digit: string;
  urgent: boolean;
  critical: boolean;
}) {
  const borderClass = critical
    ? "border-b-snkrs-crimson"
    : urgent
      ? "border-b-snkrs-crimson/50"
      : "border-b-white/10";

  return (
    <div
      className={`
        relative flex items-center justify-center
        w-[72px] h-[96px]
        border-b-2 overflow-hidden
        ${borderClass}
        ${urgent ? "animate-pulse-glow" : ""}
      `}
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={digit}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="text-6xl font-black tabular-nums text-white"
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function DigitPair({
  value,
  label,
  urgent,
  critical,
}: {
  value: number;
  label: string;
  urgent: boolean;
  critical: boolean;
}) {
  const [d1, d2] = splitDigits(value);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        <DigitCard digit={d1} urgent={urgent} critical={critical} />
        <DigitCard digit={d2} urgent={urgent} critical={critical} />
      </div>
      <span className="text-[9px] uppercase tracking-[0.3em] text-white/25">
        {label}
      </span>
    </div>
  );
}

function ColonSeparator({ critical }: { critical: boolean }) {
  return (
    <div className="flex items-center pb-6">
      <span
        className={`text-4xl font-black ${
          critical ? "text-snkrs-crimson" : "text-white/20"
        }`}
      >
        :
      </span>
    </div>
  );
}

export default function CountdownTimerDramatic({
  targetTime,
  onComplete,
}: CountdownTimerDramaticProps) {
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

  const urgent = timeLeft < 60 && timeLeft > 0;
  const critical = timeLeft < 10 && timeLeft > 0;

  return (
    <div className={`text-center ${critical ? "animate-heartbeat" : ""}`}>
      <p className="text-[10px] tracking-[0.4em] text-white/40 uppercase mb-6 font-medium">
        Dropping In
      </p>
      <div className="flex items-start justify-center gap-3">
        <DigitPair value={hours} label="Hours" urgent={urgent} critical={critical} />
        <ColonSeparator critical={critical} />
        <DigitPair value={minutes} label="Minutes" urgent={urgent} critical={critical} />
        <ColonSeparator critical={critical} />
        <DigitPair value={seconds} label="Seconds" urgent={urgent} critical={critical} />
      </div>
    </div>
  );
}
