"use client";

import { Suspense } from "react";
import PaymentContent from "./PaymentContent";

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <main className="flex items-center justify-center min-h-screen">
          <p className="text-midnight-100/60 animate-pulse">
            Loading payment...
          </p>
        </main>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}
