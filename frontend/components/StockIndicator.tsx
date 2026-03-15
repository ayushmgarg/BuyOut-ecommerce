"use client";

import { useWebSocket } from "@/hooks/useWebSocket";

interface StockIndicatorProps {
  productId: string;
}

export default function StockIndicator({ productId }: StockIndicatorProps) {
  const { stock, connected } = useWebSocket(productId);

  const isSoldOut = stock !== null && stock <= 0;
  const isLow = stock !== null && stock > 0 && stock < 100;

  const accentColor = isSoldOut
    ? "bg-snkrs-crimson"
    : isLow
      ? "bg-snkrs-orange"
      : "bg-snkrs-success";

  const text = stock === null
    ? "LOADING..."
    : isSoldOut
      ? "SOLD OUT"
      : isLow
        ? `ONLY ${stock.toLocaleString()} LEFT`
        : `${stock.toLocaleString()} REMAINING`;

  const textColor = isSoldOut
    ? "text-snkrs-crimson"
    : isLow
      ? "text-snkrs-orange"
      : "text-white/70";

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 bg-white/[0.03] border border-white/[0.06]">
      <div className={`w-[3px] h-5 ${accentColor}`} />
      <span className={`text-xs font-bold tracking-[0.2em] uppercase ${textColor}`}>
        {text}
      </span>
      <span
        className={`w-2 h-2 rounded-full ml-auto ${
          connected ? "bg-snkrs-success" : "bg-snkrs-crimson"
        }`}
      />
    </div>
  );
}
