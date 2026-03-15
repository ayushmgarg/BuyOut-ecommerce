"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

interface WaitingRoomProps {
  productId: string;
  userId: string;
  onTokenReceived: (token: string) => void;
  onSoldOut: () => void;
}

export default function WaitingRoom({ productId, userId, onTokenReceived, onSoldOut }: WaitingRoomProps) {
  const [position, setPosition] = useState<number | null>(null);
  const [totalInQueue, setTotalInQueue] = useState<number | null>(null);
  const [totalJoined, setTotalJoined] = useState<number | null>(null);
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [joined, setJoined] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);
  const [receivedToken, setReceivedToken] = useState<string | null>(null);
  const redirectedRef = useRef(false);
  const soldOutRef = useRef(false);

  // When token received, show "You're in!" briefly then redirect
  useEffect(() => {
    if (tokenReady && receivedToken && !redirectedRef.current) {
      redirectedRef.current = true;
      const timer = setTimeout(() => {
        onTokenReceived(receivedToken);
        // Fallback: if router.push didn't navigate, force it
        setTimeout(() => {
          window.location.href = `/buy?token=${encodeURIComponent(receivedToken)}`;
        }, 500);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [tokenReady, receivedToken, onTokenReceived]);

  useEffect(() => {
    if (tokenReady) return;

    if (!joined) {
      api.joinWaitingRoom(productId, userId).then((data) => {
        setJoined(true);
        setPosition(data.position);
        setTotalInQueue(data.total);
        setTotalJoined(data.total_joined);
        setEstimatedWait(data.estimated_wait_seconds);

        if (data.status === "ready" && data.token) {
          setReceivedToken(data.token);
          setTokenReady(true);
        }
      }).catch((err) => {
        if (err.message?.includes("410") || err.message?.includes("Sold out")) {
          if (!soldOutRef.current) {
            soldOutRef.current = true;
            onSoldOut();
          }
        }
      });
      return;
    }

    const interval = setInterval(async () => {
      try {
        const data = await api.getPosition(productId, userId);
        setPosition(data.position);
        setTotalInQueue(data.total);
        setTotalJoined(data.total_joined);
        setEstimatedWait(data.estimated_wait_seconds);

        if (data.status === "sold_out") {
          clearInterval(interval);
          if (!soldOutRef.current) {
            soldOutRef.current = true;
            onSoldOut();
          }
          return;
        }

        if (data.status === "ready" && data.token) {
          clearInterval(interval);
          setReceivedToken(data.token);
          setTokenReady(true);
        }
      } catch {
        // ignore transient errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [joined, productId, userId, tokenReady, onSoldOut]);

  if (tokenReady) {
    return (
      <div className="text-center">
        <CheckCircle2
          size={56}
          className="mx-auto mb-5 text-snkrs-success"
        />
        <p className="text-4xl font-black uppercase tracking-tight text-snkrs-success mb-2">
          You&apos;re In
        </p>
        {totalJoined !== null && totalJoined > 1 && (
          <p className="text-xs tracking-[0.2em] uppercase text-white/30 mb-2">
            {totalJoined.toLocaleString()} users joined this drop
          </p>
        )}
        <p className="text-white/40 text-sm">
          Redirecting to purchase...
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      {/* Pulsing rings */}
      <div className="relative w-20 h-20 mx-auto mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-snkrs-crimson/10 animate-ping" style={{ animationDuration: "2s" }} />
        <div className="absolute inset-2 rounded-full border-2 border-snkrs-crimson/20 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.3s" }} />
        <div className="absolute inset-4 rounded-full border-2 border-snkrs-crimson/30 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.6s" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-snkrs-crimson" />
        </div>
      </div>

      {position !== null && (
        <div className="mb-4">
          <p className="text-8xl font-black text-snkrs-crimson tabular-nums leading-none mb-1">
            #{position + 1}
          </p>
          {totalInQueue !== null && totalInQueue > 1 && (
            <p className="text-lg text-white/30">
              of {totalInQueue.toLocaleString()} in line
            </p>
          )}
        </div>
      )}

      {totalJoined !== null && totalJoined > 1 && (
        <p className="text-xs tracking-[0.2em] uppercase text-white/20 mb-2">
          {totalJoined.toLocaleString()} total joined
        </p>
      )}

      {estimatedWait !== null && estimatedWait > 0 && (
        <p className="text-xs tracking-[0.3em] uppercase text-white/30">
          Est. wait: ~{estimatedWait} sec
        </p>
      )}
    </div>
  );
}
