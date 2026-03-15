"use client";

import { useWebSocket } from "@/hooks/useWebSocket";

interface StockIndicatorProps {
  productId: string;
}

export default function StockIndicator({ productId }: StockIndicatorProps) {
  const { stock, event, connected } = useWebSocket(productId);

  const isSoldOut = stock !== null && stock <= 0;

  return (
    <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-midnight-800/60 border border-midnight-700/50">
      <span
        className={`w-3 h-3 rounded-full ${
          connected ? "bg-green-400 animate-pulse" : "bg-red-400"
        }`}
      />
      <span className="text-sm text-midnight-100/80">
        {stock === null
          ? "Loading..."
          : isSoldOut
          ? "SOLD OUT"
          : `${stock} left`}
      </span>
      {event && !isSoldOut && (
        <span className="text-xs text-midnight-100/40">({event})</span>
      )}
    </div>
  );
}
