"use client";

import { useCallback, useEffect, useState } from "react";
import {
  apiGet,
  ApiClientError,
  type BuyerFinancingDto,
  type OpenFinancingDto,
  type SellerFinancingDto,
} from "@/lib/api/client";

export function useSellerFinancing(id: string | undefined) {
  const [data, setData] = useState<SellerFinancingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  const refresh = useCallback(async () => {
    if (!id) return null;
    setLoading(true);
    setError(null);
    try {
      const pos = await apiGet<SellerFinancingDto>(`/api/v1/financing/seller/${id}`);
      setData(pos);
      return pos;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load seller financing");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}

export function useBuyerFinancing(id: string | undefined) {
  const [data, setData] = useState<BuyerFinancingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  const refresh = useCallback(async () => {
    if (!id) return null;
    setLoading(true);
    setError(null);
    try {
      const pos = await apiGet<BuyerFinancingDto>(`/api/v1/financing/buyer/${id}`);
      setData(pos);
      return pos;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load buyer financing");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}

export function useOpenFinancing() {
  const [data, setData] = useState<OpenFinancingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const open = await apiGet<OpenFinancingDto>("/api/v1/financing/open");
      setData(open);
      return open;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load open financing");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
