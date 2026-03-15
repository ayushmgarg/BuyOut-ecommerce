"use client";

import { useState } from "react";

interface PaymentFormProps {
  clientSecret: string;
  reservationId: string;
  productId: string;
}

export default function PaymentForm({ clientSecret, reservationId, productId }: PaymentFormProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMockPayment = async () => {
    setProcessing(true);
    setError(null);

    try {
      // In mock mode, simulate payment by calling webhook directly
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/webhook/stripe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment_intent.succeeded",
          data: {
            object: {
              id: clientSecret.split("_secret_")[0],
              amount: 14999,
              metadata: {
                reservation_id: reservationId,
                product_id: productId,
              },
            },
          },
        }),
      });

      if (res.ok) {
        window.location.href = "/success";
      } else {
        setError("Payment failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mt-8 w-full max-w-md">
      <div className="bg-midnight-800 rounded-xl p-6 border border-midnight-700/50">
        <h3 className="text-lg font-semibold mb-4">Payment</h3>

        {clientSecret.startsWith("mock_") ? (
          <div>
            <p className="text-sm text-midnight-100/60 mb-4">
              Mock payment mode — no real charges.
            </p>
            <button
              onClick={handleMockPayment}
              disabled={processing}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg font-semibold transition-colors"
            >
              {processing ? "Processing..." : "Confirm Payment — $149.99"}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-midnight-100/60 mb-4">
              Stripe Elements would load here with client secret.
            </p>
            <p className="text-xs text-midnight-100/40">
              Use test card: 4242 4242 4242 4242
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
      </div>
    </div>
  );
}
