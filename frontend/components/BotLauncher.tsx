"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";

interface BotLauncherProps {
  onReset: () => void;
}

type BotCount = 30 | 1000 | 10000;

const COUNT_OPTIONS: { value: BotCount; label: string }[] = [
  { value: 30, label: "30" },
  { value: 1000, label: "1K" },
  { value: 10000, label: "10K" },
];

export default function BotLauncher({ onReset }: BotLauncherProps) {
  const [selectedCount, setSelectedCount] = useState<BotCount>(30);
  const [launched, setLaunched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLaunch = useCallback(async () => {
    if (launched || loading) return;

    setLoading(true);
    setMessage(null);

    try {
      const result = await api.launchBots(selectedCount);
      setLaunched(true);
      setMessage(result.message ?? "Bots launched successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to launch bots";
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedCount, launched, loading]);

  const handleReset = useCallback(() => {
    setLaunched(false);
    setMessage(null);
    setLoading(false);
    onReset();
  }, [onReset]);

  return (
    <details className="group">
      <summary className="text-[9px] tracking-[0.4em] uppercase text-white/15 cursor-pointer hover:text-white/30 transition-colors text-center list-none select-none">
        Developer Tools
      </summary>

      <div className="mt-3 p-4 border border-white/[0.04] bg-white/[0.02]">
        {/* Segmented control */}
        <div className="flex gap-1 mb-3">
          {COUNT_OPTIONS.map(({ value, label }) => {
            const isSelected = selectedCount === value;
            return (
              <button
                key={value}
                type="button"
                disabled={launched}
                onClick={() => setSelectedCount(value)}
                className={`
                  flex-1 px-3 py-1.5 text-xs font-mono transition-all border
                  ${
                    isSelected
                      ? "bg-white/10 border-white/20 text-white"
                      : "bg-white/[0.02] border-white/[0.06] text-white/40"
                  }
                  ${launched ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.06]"}
                `}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Launch button */}
        <button
          type="button"
          disabled={launched || loading}
          onClick={handleLaunch}
          className={`
            w-full py-2.5 text-xs font-bold uppercase tracking-[0.2em] transition-all btn-snkrs
            ${
              launched
                ? "bg-snkrs-success/10 border border-snkrs-success/30 text-snkrs-success cursor-not-allowed"
                : loading
                  ? "bg-white/5 text-white/30 cursor-wait"
                  : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
            }
          `}
        >
          {loading ? "Launching..." : launched ? "Bots Launched" : "Launch Bots"}
        </button>

        {message && (
          <p className={`mt-2 text-[10px] text-center ${launched ? "text-snkrs-success/60" : "text-snkrs-crimson/60"}`}>
            {message}
          </p>
        )}

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={handleReset}
            className="text-[10px] text-white/20 hover:text-white/50 transition-colors cursor-pointer tracking-widest uppercase"
          >
            Reset Sale
          </button>
        </div>
      </div>
    </details>
  );
}
