"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import WaitingRoom from "@/components/WaitingRoom";
import StockIndicator from "@/components/StockIndicator";
import { api } from "@/lib/api";

const PRODUCT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const BOT_OPTIONS = [30, 1000, 10000];

export default function WaitingRoomPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [botsLaunched, setBotsLaunched] = useState(false);
  const [botMessage, setBotMessage] = useState<string | null>(null);

  // Persist userId in sessionStorage so refresh keeps queue position
  useEffect(() => {
    const stored = sessionStorage.getItem("flash_sale_user_id");
    if (stored) {
      setUserId(stored);
    } else {
      const id = `user_${crypto.randomUUID().slice(0, 8)}`;
      sessionStorage.setItem("flash_sale_user_id", id);
      setUserId(id);
    }
  }, []);

  const handleTokenReceived = useCallback(
    (token: string) => {
      router.push(`/buy?token=${encodeURIComponent(token)}`);
    },
    [router]
  );

  const handleSoldOut = useCallback(() => {
    router.push("/sold-out");
  }, [router]);

  const launchBots = (count: number) => {
    setBotMessage(null);
    api.launchBots(count).then((data) => {
      setBotsLaunched(true);
      setBotMessage(data.message);
    }).catch(() => {
      setBotMessage("Failed to launch bots");
    });
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-5xl font-bold mb-2 tracking-tight">
        Midnight Product Drop
      </h1>
      <p className="text-midnight-100/60 mb-12 text-lg">
        The sale is live &mdash; hang tight!
      </p>

      <StockIndicator productId={PRODUCT_ID} />

      <div className="mt-12">
        {userId ? (
          <WaitingRoom
            productId={PRODUCT_ID}
            userId={userId}
            onTokenReceived={handleTokenReceived}
            onSoldOut={handleSoldOut}
          />
        ) : (
          <div className="w-16 h-16 border-4 border-midnight-500 border-t-transparent rounded-full animate-spin mx-auto" />
        )}
      </div>

      <div className="mt-10">
        {!botsLaunched ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-midnight-100/40 uppercase tracking-widest">
              Launch Bots
            </p>
            <div className="flex gap-3">
              {BOT_OPTIONS.map((count) => (
                <button
                  key={count}
                  onClick={() => launchBots(count)}
                  className="px-4 py-2 bg-midnight-700 hover:bg-midnight-600 border border-midnight-500/30 rounded-lg text-sm text-midnight-100/80 transition-colors"
                >
                  {count.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-green-400/80">
            {botMessage}
          </p>
        )}
        {!botsLaunched && botMessage && (
          <p className="mt-2 text-sm text-red-400/80 text-center">{botMessage}</p>
        )}
      </div>
    </main>
  );
}
