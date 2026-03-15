"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import WaitingRoom from "@/components/WaitingRoom";
import StockIndicator from "@/components/StockIndicator";
import SneakerHero from "@/components/SneakerHero";
import BotLauncher from "@/components/BotLauncher";
import { api } from "@/lib/api";

const PRODUCT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

export default function WaitingRoomPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

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

  const handleReset = useCallback(() => {
    api.resetSale().then(() => {
      router.push("/");
    });
  }, [router]);

  return (
    <main className="relative min-h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Product strip */}
      <div className="border-b border-white/[0.04] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <SneakerHero size="sm" className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/80">
              Air Max Midnight
            </p>
            <p className="text-[10px] tracking-[0.15em] uppercase text-white/30 mt-0.5">
              Midnight Edition &mdash; $149.99
            </p>
          </div>
          <div className="shrink-0">
            <StockIndicator productId={PRODUCT_ID} />
          </div>
        </div>
      </div>

      {/* Queue area */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4">
        {userId ? (
          <WaitingRoom
            productId={PRODUCT_ID}
            userId={userId}
            onTokenReceived={handleTokenReceived}
            onSoldOut={handleSoldOut}
          />
        ) : (
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
        )}

        {/* Bot Launcher */}
        <div className="mt-12 w-full max-w-sm">
          <BotLauncher onReset={handleReset} />
        </div>
      </div>
    </main>
  );
}
