"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SoldOutBanner from "@/components/SoldOutBanner";
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
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-5xl font-bold mb-2 tracking-tight">
        Midnight Product Drop
      </h1>
      <p className="text-midnight-100/60 mb-12 text-lg">
        Limited Edition Sneakers
      </p>

      <SoldOutBanner />

      <button
        onClick={handleReset}
        disabled={resetting}
        className={`
          mt-8 px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all
          ${
            resetting
              ? "bg-midnight-700/50 text-midnight-100/50 cursor-wait"
              : "bg-gradient-to-r from-midnight-700 to-midnight-500 hover:from-midnight-600 hover:to-midnight-400 text-white cursor-pointer"
          }
        `}
      >
        {resetting ? "Restocking..." : "Restock & Restart"}
      </button>

      <a
        href="/"
        className="mt-4 text-xs text-midnight-100/30 hover:text-midnight-100/60 transition-colors"
      >
        Back to Home
      </a>
    </main>
  );
}
