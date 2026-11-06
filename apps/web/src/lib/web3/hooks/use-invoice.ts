"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, ApiClientError, type InvoiceDto } from "@/lib/api/client";

export function useInvoice(invoiceId: string | undefined) {
  const [data, setData] = useState<InvoiceDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(invoiceId));

  const refresh = useCallback(async () => {
    if (!invoiceId) return null;
    setLoading(true);
    setError(null);
    try {
      const invoice = await apiGet<InvoiceDto>(`/api/v1/invoices/${invoiceId}`);
      setData(invoice);
      return invoice;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load invoice");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
