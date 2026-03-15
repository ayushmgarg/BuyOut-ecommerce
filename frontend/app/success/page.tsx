"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import SneakerHero from "@/components/SneakerHero";

const CONFETTI_COLORS = ["#c41230", "#ff6b35", "#00d68f", "#ffffff", "#c4b5fd", "#f59e0b"];

function ConfettiParticle({ index }: { index: number }) {
  const [style] = useState(() => ({
    left: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 2}s`,
    animationDuration: `${2.5 + Math.random() * 2}s`,
    backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    width: `${6 + Math.random() * 6}px`,
    height: `${6 + Math.random() * 6}px`,
    borderRadius: Math.random() > 0.5 ? "50%" : "0",
  }));

  return (
    <div
      className="absolute top-0 pointer-events-none"
      style={{
        ...style,
        animation: `confetti-fall ${style.animationDuration} ease-in ${style.animationDelay} forwards`,
      }}
    />
  );
}

export default function SuccessPage() {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    setShowConfetti(true);
  }, []);

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] overflow-hidden px-4">
      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <ConfettiParticle key={i} index={i} />
          ))}
        </div>
      )}

      {/* Sneaker */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <SneakerHero size="md" floating glowing />
      </motion.div>

      {/* Success icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.5 }}
        className="mt-4 mb-4"
      >
        <CheckCircle2 size={56} className="text-snkrs-success" />
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className="text-center"
      >
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight text-white mb-2">
          You Got &apos;Em
        </h1>
        <p className="text-sm tracking-[0.2em] uppercase text-white/30 mb-1">
          Air Max Midnight
        </p>
        <p className="text-xs text-white/20 mb-8">
          Order confirmed &mdash; you&apos;ll receive a confirmation email shortly
        </p>

        <a
          href="/"
          className="inline-block px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white/60 border border-white/20 hover:border-white/40 hover:text-white transition-colors btn-snkrs"
        >
          Back to Home
        </a>
      </motion.div>
    </main>
  );
}
