"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useReservation } from "@/hooks/useReservation";
import StockIndicator from "@/components/StockIndicator";

const PRODUCT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

export default function BuyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const { status, reservationId, error, reserve } = useReservation();
  const redirected = useRef(false);

  // Redirect to /payment once reservation succeeds
  useEffect(() => {
    if (status === "reserved" && reservationId && !redirected.current) {
      redirected.current = true;
      const params = new URLSearchParams({
        rid: reservationId,
        pid: PRODUCT_ID,
      });
      router.push(`/payment?${params}`);
    }
  }, [status, reservationId, router]);

  // Redirect to /sold-out when stock is gone
  useEffect(() => {
    if (status === "sold_out") {
      router.push("/sold-out");
    }
  }, [status, router]);

  if (!token) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">
            No access token. You need to go through the waiting room first.
          </p>
          <a
            href="/"
            className="text-midnight-500 hover:text-midnight-400 underline"
          >
            Back to home
          </a>
        </div>
      </main>
    );
  }

  const handleReserve = useCallback(() => {
    reserve(PRODUCT_ID, token);
  }, [reserve, token]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-2">Midnight Edition Sneakers</h1>
      <p className="text-midnight-100/60 mb-8">$149.99 &mdash; Limited to 1 per person</p>

      <StockIndicator productId={PRODUCT_ID} />

      {status === "idle" && (
        <button
          onClick={handleReserve}
          className="mt-8 px-8 py-4 bg-midnight-500 hover:bg-midnight-600 rounded-xl text-lg font-semibold transition-colors"
        >
          Reserve Now &mdash; $149.99
        </button>
      )}

      {status === "reserving" && (
        <p className="mt-8 text-midnight-100/60 animate-pulse">
          Reserving your pair...
        </p>
      )}

      {status === "reserved" && (
        <p className="mt-8 text-green-400 animate-pulse">
          Reserved! Redirecting to payment...
        </p>
      )}

      {status === "error" && (
        <div className="mt-8 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-midnight-500 hover:bg-midnight-600 rounded-lg font-semibold transition-colors"
          >
            Start Over
          </a>
        </div>
      )}
    </main>
  );
}
