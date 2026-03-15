"use client";

import { useState, useRef, useEffect } from "react";
import { X, CreditCard, Lock, CheckCircle2 } from "lucide-react";

interface PaymentModalProps {
  clientSecret: string;
  reservationId: string;
  productId: string;
  onSuccess: () => void;
  onClose: () => void;
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length > 2) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

export default function PaymentModal({
  clientSecret,
  reservationId,
  productId,
  onSuccess,
  onClose,
}: PaymentModalProps) {
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/28");
  const [cvc, setCvc] = useState("123");
  const [name, setName] = useState("John Doe");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !processing) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, processing]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !processing) {
      onClose();
    }
  };

  const cardDigits = cardNumber.replace(/\s/g, "");
  const expiryDigits = expiry.replace("/", "");
  const isValid =
    cardDigits.length === 16 &&
    expiryDigits.length === 4 &&
    cvc.length >= 3 &&
    name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || processing) return;

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/webhook/stripe`,
        {
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
        }
      );

      if (res.ok) {
        setSuccess(true);
        setTimeout(onSuccess, 1500);
      } else {
        setError("Payment declined. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md mx-4 bg-midnight-900 border border-midnight-700/50 rounded-2xl shadow-2xl overflow-hidden"
        style={{ boxShadow: "0 0 60px rgba(107, 92, 231, 0.15)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-midnight-700/40">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-green-400" />
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-white/70">
              Checkout
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="text-midnight-100/40 hover:text-midnight-100/70 transition-colors disabled:opacity-30"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle2
              size={48}
              className="mx-auto text-green-400 mb-4"
            />
            <h3 className="text-xl font-bold text-white mb-2">
              Payment Successful
            </h3>
            <p className="text-midnight-100/60 text-sm">
              Your Midnight Edition Sneakers are confirmed.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Order summary */}
            <div className="flex items-center justify-between pb-4 border-b border-midnight-700/30">
              <div>
                <p className="text-sm font-semibold text-white">
                  Midnight Edition Sneakers
                </p>
                <p className="text-xs text-midnight-100/50">Qty: 1</p>
              </div>
              <p className="text-lg font-bold text-white">$149.99</p>
            </div>

            {/* Card number */}
            <div>
              <label className="block text-xs font-medium text-midnight-100/60 mb-1.5">
                Card number
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={cardNumber}
                  onChange={(e) =>
                    setCardNumber(formatCardNumber(e.target.value))
                  }
                  placeholder="1234 5678 9012 3456"
                  className="w-full bg-midnight-800 border border-midnight-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-midnight-100/30 focus:outline-none focus:border-midnight-500 focus:ring-1 focus:ring-midnight-500/30 transition-colors"
                />
                <CreditCard
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-midnight-100/30"
                />
              </div>
            </div>

            {/* Expiry + CVC row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-midnight-100/60 mb-1.5">
                  Expiry
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  className="w-full bg-midnight-800 border border-midnight-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-midnight-100/30 focus:outline-none focus:border-midnight-500 focus:ring-1 focus:ring-midnight-500/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-midnight-100/60 mb-1.5">
                  CVC
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cvc}
                  onChange={(e) =>
                    setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="123"
                  className="w-full bg-midnight-800 border border-midnight-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-midnight-100/30 focus:outline-none focus:border-midnight-500 focus:ring-1 focus:ring-midnight-500/30 transition-colors"
                />
              </div>
            </div>

            {/* Cardholder name */}
            <div>
              <label className="block text-xs font-medium text-midnight-100/60 mb-1.5">
                Cardholder name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full bg-midnight-800 border border-midnight-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-midnight-100/30 focus:outline-none focus:border-midnight-500 focus:ring-1 focus:ring-midnight-500/30 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || processing}
              className="w-full py-3 bg-snkrs-crimson hover:bg-snkrs-crimson/90 disabled:bg-midnight-700 disabled:text-midnight-100/30 rounded-sm font-bold text-sm uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock size={14} />
                  Pay $149.99
                </>
              )}
            </button>

            <p className="text-[10px] text-midnight-100/30 text-center">
              Secured with 256-bit encryption
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
