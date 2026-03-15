"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useReservation } from "@/hooks/useReservation";
import StockIndicator from "@/components/StockIndicator";
import PaymentModal from "@/components/PaymentModal";
import SneakerHero from "@/components/SneakerHero";

const PRODUCT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const SIZES = ["US 8", "US 8.5", "US 9", "US 9.5", "US 10", "US 10.5", "US 11", "US 11.5", "US 12"];

export default function BuyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const { status, reservationId, clientSecret, error, reserve, createPaymentIntent } =
    useReservation();
  const [showPayment, setShowPayment] = useState(false);
  const [selectedSize, setSelectedSize] = useState("US 10");
  const intentCreated = useRef(false);

  useEffect(() => {
    if (status === "reserved" && reservationId && !intentCreated.current) {
      intentCreated.current = true;
      createPaymentIntent(reservationId, PRODUCT_ID);
    }
  }, [status, reservationId, createPaymentIntent]);

  useEffect(() => {
    if (clientSecret) {
      setShowPayment(true);
    }
  }, [clientSecret]);

  useEffect(() => {
    if (status === "sold_out") {
      router.push("/sold-out");
    }
  }, [status, router]);

  if (!token) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-[#0a0a0f]">
        <div className="text-center">
          <p className="text-snkrs-crimson text-sm font-bold uppercase tracking-[0.2em] mb-4">
            No Access Token
          </p>
          <p className="text-white/40 text-sm mb-6">
            You need to go through the waiting room first.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white/60 border border-white/10 hover:border-white/30 hover:text-white transition-colors btn-snkrs"
          >
            Back to Home
          </a>
        </div>
      </main>
    );
  }

  const handleReserve = useCallback(() => {
    reserve(PRODUCT_ID, token);
  }, [reserve, token]);

  const handlePaymentSuccess = () => {
    router.push("/success");
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg card-glass rounded-sm p-8"
      >
        {/* Sneaker visual */}
        <div className="flex justify-center mb-4">
          <SneakerHero size="md" floating />
        </div>

        {/* Product info */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black uppercase tracking-tight text-white mb-1">
            Air Max Midnight
          </h1>
          <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 mb-3">
            Midnight Edition &bull; Limited Release
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm text-white/30 line-through">$220.00</span>
            <span className="text-xl font-black text-snkrs-crimson">$149.99</span>
          </div>
        </div>

        {/* Stock */}
        <div className="mb-6">
          <StockIndicator productId={PRODUCT_ID} />
        </div>

        {/* Size selector */}
        <div className="mb-6">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40 mb-2">
            Select Size
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {SIZES.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`py-2 text-[10px] font-bold tracking-wider transition-all border ${
                  selectedSize === size
                    ? "bg-white text-black border-white"
                    : "bg-transparent text-white/50 border-white/10 hover:border-white/30"
                }`}
              >
                {size.replace("US ", "")}
              </button>
            ))}
          </div>
        </div>

        {/* Reserve button */}
        {status === "idle" && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleReserve}
            className="w-full py-4 bg-snkrs-crimson hover:bg-snkrs-crimson/90 text-white text-sm font-bold uppercase tracking-[0.2em] btn-snkrs transition-colors"
          >
            Reserve &mdash; $149.99
          </motion.button>
        )}

        {(status === "reserving" || status === "paying") && (
          <div className="w-full py-4 text-center">
            <div className="inline-flex items-center gap-2 text-white/50 text-sm font-bold uppercase tracking-[0.2em]">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              {status === "reserving" ? "Securing Your Pair..." : "Setting Up Payment..."}
            </div>
          </div>
        )}

        {status === "reserved" && !clientSecret && (
          <div className="w-full py-4 text-center">
            <div className="inline-flex items-center gap-2 text-snkrs-success text-sm font-bold uppercase tracking-[0.2em] animate-pulse">
              <div className="w-4 h-4 border-2 border-snkrs-success/30 border-t-snkrs-success rounded-full animate-spin" />
              Reserved! Preparing Payment...
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <p className="text-snkrs-crimson text-sm mb-4">{error}</p>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleReserve}
              className="w-full py-4 bg-snkrs-crimson hover:bg-snkrs-crimson/90 text-white text-sm font-bold uppercase tracking-[0.2em] btn-snkrs transition-colors"
            >
              Try Again
            </motion.button>
          </div>
        )}
      </motion.div>

      {showPayment && clientSecret && reservationId && (
        <PaymentModal
          clientSecret={clientSecret}
          reservationId={reservationId}
          productId={PRODUCT_ID}
          onSuccess={handlePaymentSuccess}
          onClose={() => setShowPayment(false)}
        />
      )}
    </main>
  );
}
