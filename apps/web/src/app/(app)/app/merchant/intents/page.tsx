"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { WalletGate } from "@/components/shared/wallet-gate";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, type PaymentIntentDto } from "@/lib/api/client";

export default function PaymentLinksPage() {
  const { address } = useAccount();
  const [items, setItems] = useState<PaymentIntentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ items: PaymentIntentDto[] }>(
        `/api/v1/payments/intents?merchant=${address}&limit=30`,
      );
      setItems(res.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load intents");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => (filter === "ALL" ? items : items.filter((i) => i.status === filter)),
    [filter, items],
  );

  const filters = ["ALL", "CREATED", "SETTLED", "PARTIALLYREFUNDED", "REFUNDED", "EXPIRED", "CANCELLED"];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Payment links"
        description="Bounded event scan from PaymentProcessor via API"
        actions={
          <Button asChild>
            <Link href="/app/merchant/intents/new">
              <Plus className="h-4 w-4" /> Create link
            </Link>
          </Button>
        }
      />

      <WalletGate>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f === "ALL" ? "All" : f}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        {loading ? <Skeleton className="h-40 w-full" /> : null}
        {error ? <ErrorState description={error} onRetry={() => void load()} /> : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptyState
            title="No intents yet"
            description="Create a payment link to see history from chain events."
            actionLabel="Create link"
            onAction={() => {
              window.location.href = "/app/merchant/intents/new";
            }}
          />
        ) : null}

        {rows.length > 0 ? (
          <Card>
            <CardContent className="pt-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ref</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confirmation</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((i) => (
                    <TableRow key={i.intentId}>
                      <TableCell className="font-medium">{i.orderRef}</TableCell>
                      <TableCell className="tabular">{i.amountUsdt} USDT</TableCell>
                      <TableCell>
                        <StatusBadge status={i.status} />
                      </TableCell>
                      <TableCell>
                        {i.confirmationStage ? (
                          <StatusBadge status={i.confirmationStage} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/app/merchant/intents/${i.intentId}`}>Details</Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/pay/${i.intentId}`}>Checkout</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </WalletGate>
    </div>
  );
}
