"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";

type ReservationStatus =
  | "idle"
  | "reserving"
  | "reserved"
  | "paying"
  | "sold_out"
  | "error";

interface ReservationState {
  status: ReservationStatus;
  reservationId: string | null;
  clientSecret: string | null;
  error: string | null;
  reserve: (productId: string, token: string) => void;
  createPaymentIntent: (reservationId: string, productId: string) => void;
}

export function useReservation(): ReservationState {
  const [status, setStatus] = useState<ReservationStatus>("idle");
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reserve = useCallback(async (productId: string, token: string) => {
    setStatus("reserving");
    setError(null);

    try {
      const data = await api.reserve(productId, token);

      if (data.status === "reserved") {
        setReservationId(data.reservation_id);
        setStatus("reserved");
      } else if (data.status === "out_of_stock") {
        setStatus("sold_out");
      } else {
        setError(data.message || "Reservation failed");
        setStatus("error");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Reservation failed";
      setError(message);
      setStatus("error");
    }
  }, []);

  const createPaymentIntent = useCallback(
    async (resId: string, productId: string) => {
      setStatus("paying");

      try {
        const data = await api.createPaymentIntent(resId, productId);
        setClientSecret(data.client_secret);
        setStatus("reserved"); // Back to reserved with clientSecret populated
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Payment setup failed";
        setError(message);
        setStatus("error");
      }
    },
    []
  );

  return { status, reservationId, clientSecret, error, reserve, createPaymentIntent };
}
