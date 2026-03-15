"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import CountdownTimer from "@/components/CountdownTimer";
import StockIndicator from "@/components/StockIndicator";
import { api } from "@/lib/api";

const PRODUCT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

export default function Home() {
  const router = useRouter();
  const [targetTime, setTargetTime] = useState<Date | null>(null);
  const [botsLaunched, setBotsLaunched] = useState(false);
  const [botMessage, setBotMessage] = useState<string | null>(null);

  // Fetch sale start time from server
  useEffect(() => {
    api.getSaleInfo(PRODUCT_ID).then((data) => {
      if (data.starts_at) {
        const startsAt = new Date(data.starts_at * 1000);
        if (startsAt.getTime() <= Date.now()) {
          // Sale already started, go straight to waiting room
          router.push("/waiting-room");
        } else {
          setTargetTime(startsAt);
        }
      } else {
        // No start time configured, use 10s fallback
        setTargetTime(new Date(Date.now() + 10_000));
      }
    }).catch(() => {
      // API down, use fallback
      setTargetTime(new Date(Date.now() + 10_000));
    });
  }, [router]);

  const handleCountdownComplete = useCallback(() => {
    router.push("/waiting-room");
  }, [router]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-5xl font-bold mb-2 tracking-tight">
        Midnight Product Drop
      </h1>
      <p className="text-midnight-100/60 mb-12 text-lg">
        Limited Edition Sneakers &mdash; Only 100 Pairs
      </p>

      <StockIndicator productId={PRODUCT_ID} />

      <div className="mt-12">
        {targetTime ? (
          <CountdownTimer
            targetTime={targetTime}
            onComplete={handleCountdownComplete}
          />
        ) : (
          <div className="text-center">
            <p className="text-midnight-100/60 mb-4 uppercase tracking-widest text-sm">
              Loading...
            </p>
          </div>
        )}
      </div>

      {!botsLaunched ? (
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-xs text-midnight-100/40 uppercase tracking-widest">
            Launch Bots
          </p>
          <div className="flex gap-3">
            {[30, 1000, 10000].map((count) => (
              <button
                key={count}
                onClick={() => {
                  api.launchBots(count).then((data) => {
                    setBotsLaunched(true);
                    setBotMessage(data.message);
                  }).catch(() => {
                    setBotMessage("Failed to launch bots");
                  });
                }}
                className="px-4 py-2 bg-midnight-700 hover:bg-midnight-600 border border-midnight-500/30 rounded-lg text-sm text-midnight-100/80 transition-colors"
              >
                {count.toLocaleString()}
              </button>
            ))}
          </div>
          {botMessage && (
            <p className="text-sm text-red-400/80">{botMessage}</p>
          )}
        </div>
      ) : (
        <p className="mt-8 text-sm text-green-400/80">
          {botMessage}
        </p>
      )}

      <button
        onClick={() => {
          api.resetSale().then((data) => {
            setBotsLaunched(false);
            setBotMessage(null);
            setTargetTime(new Date(data.starts_at * 1000));
          });
        }}
        className="mt-6 px-4 py-2 bg-midnight-900 hover:bg-midnight-800 border border-midnight-700/30 rounded-lg text-xs text-midnight-100/50 hover:text-midnight-100/80 transition-colors uppercase tracking-widest"
      >
        Reset Sale
      </button>
    </main>
  );
}
