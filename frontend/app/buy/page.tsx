"use client";

import { Suspense } from "react";
import BuyContent from "./BuyContent";

export default function BuyPage() {
  return (
    <Suspense
      fallback={
        <main className="flex items-center justify-center min-h-screen">
          <p className="text-midnight-100/60 animate-pulse">Loading...</p>
        </main>
      }
    >
      <BuyContent />
    </Suspense>
  );
}
