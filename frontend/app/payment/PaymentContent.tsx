"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PaymentForm from "@/components/PaymentForm";
import { api } from "@/lib/api";

export default function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reservationId = searchParams.get("rid");
  const productId = searchParams.get("pid");

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reservationId || !productId) return;

    let cancelled = false;

    async function initPayment() {
      try {
        const data = await api.createPaymentIntent(reservationId!, productId!);
        if (!cancelled) {
          setClientSecret(data.client_secret);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to create payment";
          setError(message);
          setLoading(false);
        }
      }
    }

    initPayment();
    return () => {
      cancelled = true;
    };
  }, [reservationId, productId]);

  if (!reservationId || !productId) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">
            Missing reservation details. Please reserve first.
          </p>
          <a
            href="/buy"
            className="text-midnight-500 hover:text-midnight-400 underline"
          >
            Back to buy
          </a>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-3xl font-bold mb-8">Complete Your Purchase</h1>
        <p className="text-midnight-100/60 animate-pulse">
          Setting up payment...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-3xl font-bold mb-8">Payment Error</h1>
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => router.push("/buy")}
          className="px-6 py-3 bg-midnight-500 hover:bg-midnight-600 rounded-lg font-semibold transition-colors"
        >
          Back to Buy
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-2">Complete Your Purchase</h1>
      <p className="text-midnight-100/60 mb-8">
        Your reservation expires in 2 minutes. Pay now to secure your pair.
      </p>

      {clientSecret && (
        <PaymentForm
          clientSecret={clientSecret}
          reservationId={reservationId!}
          productId={productId!}
        />
      )}
    </main>
  );
}
