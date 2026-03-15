"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { api } from "@/lib/api";

const CHAOS_OPTIONS = [
  { label: "10K", value: 10000 },
  { label: "25K", value: 25000 },
  { label: "50K", value: 50000 },
];

export default function ChaosButton() {
  const [selectedCount, setSelectedCount] = useState(50000);
  const [launched, setLaunched] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [botStats, setBotStats] = useState<Record<string, number | boolean> | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const handleLaunch = () => {
    api.launchChaos(selectedCount).then((data) => {
      setLaunched(true);
      setStatusMsg(data.message);
    }).catch(() => {
      setStatusMsg("Failed to launch");
    });
  };

  // Poll bot status when active
  useEffect(() => {
    if (!launched) return;
    pollRef.current = setInterval(() => {
      api.getBotStatus().then((data) => {
        setBotStats(data);
        if (!data.running && data.in_progress === 0) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }).catch(() => {});
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [launched]);

  return (
    <div className="bg-midnight-900/80 border border-red-500/20 rounded-xl p-4 h-full flex flex-col items-center justify-center gap-3">
      <span className="text-xs uppercase tracking-[0.2em] text-red-400/80 font-bold">
        Chaos Generator
      </span>

      {!launched ? (
        <>
          <motion.button
            onClick={handleLaunch}
            className="w-20 h-20 rounded-full bg-red-600 border-2 border-red-400/60 text-white font-bold text-xs uppercase flex items-center justify-center gap-1 cursor-pointer"
            whileHover={{ scale: 1.1, boxShadow: "0 0 40px rgba(239,68,68,0.5)" }}
            whileTap={{ scale: 0.95 }}
          >
            <Zap size={16} />
            Launch
          </motion.button>

          <div className="flex gap-1">
            {CHAOS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedCount(opt.value)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  selectedCount === opt.value
                    ? "bg-red-600/40 text-red-300 border border-red-500/40"
                    : "bg-midnight-800 text-midnight-100/50 border border-midnight-700/30 hover:border-red-500/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center">
          <motion.div
            className="w-16 h-16 rounded-full bg-red-900/60 border-2 border-red-500/40 flex items-center justify-center mx-auto mb-2"
            animate={{
              boxShadow: [
                "0 0 10px rgba(239,68,68,0.3)",
                "0 0 30px rgba(239,68,68,0.6)",
                "0 0 10px rgba(239,68,68,0.3)",
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Zap size={20} className="text-red-400" />
          </motion.div>
          <p className="text-xs text-red-400/80 font-mono">{statusMsg}</p>
          {botStats && (
            <div className="mt-2 text-xs text-midnight-100/50 font-mono space-y-0.5">
              <p>Purchased: {(botStats.purchased as number) ?? 0}</p>
              <p>Sold out: {(botStats.sold_out as number) ?? 0}</p>
              <p>Remaining: {(botStats.in_progress as number) ?? 0}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
