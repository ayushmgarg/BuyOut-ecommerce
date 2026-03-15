"use client";

import { useState, useEffect, useRef } from "react";
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
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [joined, setJoined] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);
  const [receivedToken, setReceivedToken] = useState<string | null>(null);
  const redirectedRef = useRef(false);
  const soldOutRef = useRef(false);

  // When token received, show "You're in!" for 1 second before redirecting
  useEffect(() => {
    if (tokenReady && receivedToken && !redirectedRef.current) {
      redirectedRef.current = true;
      const timer = setTimeout(() => {
        onTokenReceived(receivedToken);
      }, 1000);
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
        setEstimatedWait(data.estimated_wait_seconds);

        if (data.status === "ready" && data.token) {
          setReceivedToken(data.token);
          setTokenReady(true);
        }
      }).catch((err) => {
        // 410 = sold out
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
        <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <p className="text-2xl font-bold text-green-400 mb-2">
          You&apos;re in!
        </p>
        <p className="text-midnight-100/60">
          Redirecting to purchase...
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-midnight-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
      <p className="text-xl mb-2">You&apos;re in the waiting room</p>
      {position !== null && (
        <p className="text-3xl font-bold text-midnight-500 mb-2">
          Position #{position + 1}
          {totalInQueue !== null && (
            <span className="text-lg font-normal text-midnight-100/50">
              {" "}of {totalInQueue}
            </span>
          )}
        </p>
      )}
      {estimatedWait !== null && estimatedWait > 0 && (
        <p className="text-midnight-100/60">
          Estimated wait: ~{estimatedWait}s
        </p>
      )}
    </div>
  );
}
