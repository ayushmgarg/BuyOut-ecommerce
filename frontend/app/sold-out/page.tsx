"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import SneakerHero from "@/components/SneakerHero";
import { api } from "@/lib/api";

export default function SoldOutPage() {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

  const handleReset = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await api.resetSale();
      router.push("/");
    } catch {
      setResetting(false);
    }
  }, [resetting, router]);

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] overflow-hidden px-4">
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="text-[120px] md:text-[180px] font-black uppercase text-white/[0.03] tracking-tighter leading-none">
          Sold Out
        </span>
      </div>

      {/* Sneaker (grayscale) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
      >
        <SneakerHero size="lg" grayscale />
      </motion.div>

      {/* Text overlay */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="relative z-10 text-center -mt-4"
      >
        <h1 className="text-5xl md:text-6xl font-black text-snkrs-crimson uppercase tracking-tight mb-3">
          Sold Out
        </h1>
        <p className="text-white/40 text-sm tracking-wide">
          All 1,000 pairs have been claimed
        </p>
        <div className="mt-4 mx-auto w-32 h-px bg-gradient-to-r from-transparent via-snkrs-crimson/50 to-transparent" />
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="relative z-10 mt-10 flex flex-col items-center gap-3"
      >
        <button
          onClick={handleReset}
          disabled={resetting}
          className={`px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] transition-all btn-snkrs border ${
            resetting
              ? "bg-white/5 border-white/10 text-white/30 cursor-wait"
              : "bg-transparent border-white/20 text-white/60 hover:border-white/40 hover:text-white cursor-pointer"
          }`}
        >
          {resetting ? "Restocking..." : "Restock & Restart"}
        </button>

        <a
          href="/"
          className="text-[10px] text-white/20 hover:text-white/50 transition-colors tracking-[0.3em] uppercase"
        >
          Back to Home
        </a>
      </motion.div>
    </main>
  );
}
