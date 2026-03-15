"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CountdownTimerDramatic from "@/components/CountdownTimerDramatic";
import LiveStatsBar from "@/components/LiveStatsBar";
import BotLauncher from "@/components/BotLauncher";
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
    <main className="relative flex flex-col items-center justify-center min-h-screen p-8 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 animate-radial-pulse pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(107,92,231,0.05)_0%,transparent_50%)] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 max-w-2xl w-full">
        {/* Title */}
        <div className="text-center mb-4">
          <h1 className="text-6xl font-bold tracking-[0.15em] uppercase text-gradient-purple mb-3">
            Midnight
          </h1>
          <h2 className="text-3xl font-bold tracking-[0.2em] uppercase text-midnight-100/70">
            Product Drop
          </h2>
          <p className="mt-3 text-midnight-100/40 text-sm tracking-widest uppercase">
            Limited Edition Sneakers &mdash; Only 1,000 Pairs
          </p>
        </div>

        {/* Countdown or Join Button */}
        <div className="my-6">
          {saleOpen ? (
            <div className="text-center flex flex-col items-center gap-5">
              <p className="text-sm uppercase tracking-[0.3em] text-green-400 animate-pulse font-bold">
                Sale is Live
              </p>
              <button
                onClick={() => router.push("/waiting-room")}
                className="px-10 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-lg font-bold uppercase tracking-widest rounded-xl shadow-[0_0_30px_rgba(107,92,231,0.4)] hover:shadow-[0_0_50px_rgba(107,92,231,0.6)] transition-all duration-300 transform hover:scale-105"
              >
                Join the Queue
              </button>
            </div>
          ) : targetTime ? (
            <CountdownTimerDramatic
              targetTime={targetTime}
              onComplete={handleCountdownComplete}
            />
          ) : (
            <div className="text-center py-12">
              <div className="w-6 h-6 border-2 border-midnight-500/40 border-t-midnight-500 rounded-full animate-spin mx-auto" />
              <p className="text-midnight-100/40 mt-3 text-xs uppercase tracking-widest">
                Connecting...
              </p>
            </div>
          )}
        </div>

        {/* Live Stats */}
        <LiveStatsBar />

        {/* Bot Launcher */}
        <div className="w-full max-w-sm mt-4">
          <BotLauncher onReset={handleReset} />
        </div>

        {/* Dashboard Link */}
        <Link
          href="/dashboard"
          className="mt-4 flex items-center gap-2 text-xs uppercase tracking-widest text-midnight-500 hover:text-midnight-100/80 transition-colors group"
        >
          <span>Open Observer Dashboard</span>
          <svg
            className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Link>
      </div>
    </main>
  );
}
