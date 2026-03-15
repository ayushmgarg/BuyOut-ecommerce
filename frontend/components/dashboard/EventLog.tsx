"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { TransactionEvent } from "@/lib/types";

interface EventLogProps {
  events: TransactionEvent[];
}

const MAX_DISPLAY_EVENTS = 50;

const eventTypeBadgeStyles: Record<string, { bg: string; text: string }> = {
  reserved: { bg: "bg-purple-500/20", text: "text-purple-400" },
  confirmed: { bg: "bg-green-500/20", text: "text-green-400" },
  released: { bg: "bg-amber-500/20", text: "text-amber-400" },
  sold_out: { bg: "bg-red-500/20", text: "text-red-400" },
};

const statusDotStyles: Record<string, string> = {
  success: "bg-green-400",
  failed: "bg-red-400",
  compensated: "bg-amber-400",
};

function formatTimestamp(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  const millis = date.getMilliseconds().toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${millis}`;
}

function truncateUserId(userId: string): string {
  return userId.length > 8 ? userId.slice(0, 8) : userId;
}

export default function EventLog({ events }: EventLogProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  const displayEvents = events.slice(-MAX_DISPLAY_EVENTS);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 30;

    if (!isAtBottom) {
      isUserScrollingRef.current = true;
      setAutoScroll(false);
    } else {
      isUserScrollingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const toggleAutoScroll = useCallback(() => {
    setAutoScroll((prev) => {
      const next = !prev;
      if (next) {
        isUserScrollingRef.current = false;
      }
      return next;
    });
  }, []);

  return (
    <div className="bg-midnight-900/80 border border-midnight-700/30 rounded-xl p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-midnight-100/50">
            Event Log
          </span>
          <span className="text-[10px] font-mono text-midnight-100/30 bg-midnight-800/60 px-1.5 py-0.5 rounded">
            {events.length}
          </span>
        </div>
        <button
          onClick={toggleAutoScroll}
          className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
            autoScroll
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-midnight-800/60 text-midnight-100/40 border border-midnight-700/30"
          }`}
        >
          {autoScroll ? "AUTO" : "PAUSED"}
        </button>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin"
        style={{ minHeight: 0 }}
      >
        {displayEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-midnight-100/30 font-mono">
              Waiting for events...
            </span>
          </div>
        ) : (
          <div className="space-y-px">
            {displayEvents.map((event, index) => {
              const badgeStyle =
                eventTypeBadgeStyles[event.type] ?? eventTypeBadgeStyles.reserved;
              const dotStyle =
                statusDotStyles[event.status] ?? statusDotStyles.success;

              return (
                <div
                  key={`${event.user_id}-${event.timestamp}-${index}`}
                  className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-midnight-800/40 transition-colors"
                  style={{ height: "24px" }}
                >
                  <span className="text-[10px] font-mono text-midnight-100/40 shrink-0 w-[88px]">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <span className="text-[10px] font-mono text-midnight-100/60 shrink-0 w-[64px]">
                    {truncateUserId(event.user_id)}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0 rounded shrink-0 ${badgeStyle.bg} ${badgeStyle.text}`}
                  >
                    {event.type}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyle}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
