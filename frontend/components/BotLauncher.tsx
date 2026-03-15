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
    <div className="bg-midnight-900/40 border border-midnight-700/20 rounded-xl p-6 backdrop-blur-sm">
      <h3 className="text-xs uppercase tracking-widest text-midnight-100/40 mb-4">
        Simulate Demand
      </h3>

      {/* Segmented control */}
      <div className="flex gap-1 mb-4">
        {COUNT_OPTIONS.map(({ value, label }) => {
          const isSelected = selectedCount === value;
          return (
            <button
              key={value}
              type="button"
              disabled={launched}
              onClick={() => setSelectedCount(value)}
              className={`
                flex-1 rounded-lg px-4 py-2 text-sm font-mono transition-all border
                ${
                  isSelected
                    ? "bg-midnight-700 border-midnight-500/50 text-white"
                    : "bg-midnight-900/50 border-midnight-700/30 text-midnight-100/50"
                }
                ${launched ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
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
          w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all
          ${
            launched
              ? "bg-green-900/50 border border-green-500/30 text-green-400 cursor-not-allowed"
              : loading
                ? "bg-midnight-700/50 text-midnight-100/50 cursor-wait"
                : "bg-gradient-to-r from-midnight-700 to-midnight-500 hover:from-midnight-600 hover:to-midnight-400 text-white cursor-pointer"
          }
        `}
      >
        {loading ? (
          <span className="inline-flex items-center gap-1">
            Launching
            <span className="animate-pulse">...</span>
          </span>
        ) : launched ? (
          "Bots Launched"
        ) : (
          "Launch Bots"
        )}
      </button>

      {/* Status feedback */}
      {message && (
        <p
          className={`mt-3 text-xs text-center ${
            launched ? "text-green-400/70" : "text-red-400/70"
          }`}
        >
          {message}
        </p>
      )}

      {/* Reset button */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-midnight-100/30 hover:text-midnight-100/60 transition-colors cursor-pointer"
        >
          Reset Sale
        </button>
      </div>
    </div>
  );
}
