"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import CountdownTimerDramatic from "@/components/CountdownTimerDramatic";
import LiveStatsBar from "@/components/LiveStatsBar";
import BotLauncher from "@/components/BotLauncher";
import SneakerHero from "@/components/SneakerHero";
import { api } from "@/lib/api";

const PRODUCT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

export default function Home() {
  const router = useRouter();
  const [targetTime, setTargetTime] = useState<Date | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);

  useEffect(() => {
    api
      .getSaleInfo(PRODUCT_ID)
      .then((data) => {
        if (data.starts_at) {
          const startsAt = new Date(data.starts_at * 1000);
          if (startsAt.getTime() <= Date.now()) {
            setSaleOpen(true);
          } else {
            setTargetTime(startsAt);
          }
        } else {
          setTargetTime(new Date(Date.now() + 10_000));
        }
      })
      .catch(() => {
        setTargetTime(new Date(Date.now() + 10_000));
      });
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setSaleOpen(true);
  }, []);

  const handleReset = useCallback(() => {
    api.resetSale().then((data) => {
      setSaleOpen(false);
      setTargetTime(new Date(data.starts_at * 1000));
    });
  }, []);

  return (
    <main className="relative min-h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Top nav */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-white/[0.04]">
        <span className="text-xs font-bold tracking-[0.3em] uppercase text-white/80">
          Air Max Midnight
        </span>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] uppercase text-white/30 hover:text-white/60 transition-colors"
        >
          Dashboard
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </nav>

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-snkrs-crimson/[0.04] blur-[100px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center pt-8 pb-16 px-4">
        {/* Exclusive badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <span className="inline-block px-4 py-1.5 text-[10px] font-bold tracking-[0.3em] uppercase text-snkrs-crimson border border-snkrs-crimson/30 bg-snkrs-crimson/5">
            Exclusive Drop
          </span>
        </motion.div>

        {/* Sneaker Hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <SneakerHero size="lg" floating glowing />
        </motion.div>

        {/* Product info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center mt-2 mb-8"
        >
          <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight text-white mb-2">
            Air Max Midnight
          </h1>
          <p className="text-sm tracking-[0.2em] uppercase text-white/30 mb-3">
            Midnight Edition
          </p>
          <p className="text-2xl font-black text-white">$149.99</p>
        </motion.div>

        {/* Countdown or Enter Draw */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mb-8"
        >
          {saleOpen ? (
            <div className="text-center flex flex-col items-center gap-4">
              <p className="text-[10px] uppercase tracking-[0.4em] text-snkrs-success font-bold animate-pulse">
                Drop is Live
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/waiting-room")}
                className="px-14 py-4 bg-snkrs-crimson hover:bg-snkrs-crimson/90 text-white text-sm font-bold uppercase tracking-[0.25em] btn-snkrs transition-all"
              >
                Enter Draw
              </motion.button>
            </div>
          ) : targetTime ? (
            <CountdownTimerDramatic
              targetTime={targetTime}
              onComplete={handleCountdownComplete}
            />
          ) : (
            <div className="text-center py-12">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
              <p className="text-white/30 mt-3 text-[10px] uppercase tracking-[0.3em]">
                Connecting...
              </p>
            </div>
          )}
        </motion.div>

        {/* Limited info */}
        <p className="text-[10px] tracking-[0.4em] uppercase text-white/20 mb-8">
          1,000 Pairs &bull; One Per Customer
        </p>

        {/* Live Stats */}
        <div className="w-full max-w-lg mb-6">
          <LiveStatsBar />
        </div>

        {/* Bot Launcher */}
        <div className="w-full max-w-sm">
          <BotLauncher onReset={handleReset} />
        </div>
      </div>
    </main>
  );
}
