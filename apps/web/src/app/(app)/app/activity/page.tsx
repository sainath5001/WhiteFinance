"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiPost, ApiClientError } from "@/lib/api/client";

type ScanResult = {
  fromBlock: string;
  toBlock: string;
  scanned: number;
  newlyProcessed: number;
  eventIds: string[];
  limitations?: { note?: string; durable?: boolean };
};

export default function ActivityPage() {
  const [data, setData] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<ScanResult>("/api/v1/indexer/scan", {});
      setData(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Indexer scan failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Activity"
        description="Manual PaymentSettled scan via API — local checkpoint, not durable truth"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Rescan
          </Button>
        }
      />
      {loading ? <Skeleton className="h-40 w-full" /> : null}
      {error ? <ErrorState description={error} onRetry={() => void refresh()} /> : null}
      {data ? (
        <Card>
          <CardContent className="space-y-4 p-5 text-sm">
            <div className="text-xs text-muted-foreground">
              Blocks {data.fromBlock} → {data.toBlock} · scanned {data.scanned} · newly processed{" "}
              {data.newlyProcessed}
            </div>
            {data.limitations?.note ? (
              <p className="text-xs text-muted-foreground">{data.limitations.note}</p>
            ) : null}
            {data.eventIds.length === 0 ? (
              <p className="text-muted-foreground">No new PaymentSettled events in this window.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {data.eventIds.map((id) => (
                  <li key={id} className="break-all px-3 py-2 font-mono text-[11px]">
                    {id}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              For payment detail, open merchant intents or checkout receipts (chain + API reads).
              Financial truth is never localStorage.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
