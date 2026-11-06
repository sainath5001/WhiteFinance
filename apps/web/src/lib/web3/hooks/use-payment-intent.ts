"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, type PaymentIntentDto, ApiClientError } from "@/lib/api/client";

export function usePaymentIntent(intentId: string | undefined) {
  const [data, setData] = useState<PaymentIntentDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(intentId));

  const refresh = useCallback(async () => {
    if (!intentId) return null;
    setLoading(true);
    setError(null);
    try {
      const intent = await apiGet<PaymentIntentDto>(`/api/v1/payments/intents/${intentId}`);
      setData(intent);
      return intent;
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to load payment intent from API";
      setError(message);
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [intentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
