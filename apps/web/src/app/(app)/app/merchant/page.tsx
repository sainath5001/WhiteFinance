"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { WalletGate } from "@/components/shared/wallet-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, type PaymentIntentDto } from "@/lib/api/client";

export default function MerchantOverviewPage() {
  const { address } = useAccount();
  const [items, setItems] = useState<PaymentIntentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const settled = items.filter((i) => i.status === "SETTLED" || i.status.includes("REFUND"));
  const pending = items.filter((i) => i.status === "CREATED");
  const refunds = items.filter((i) => i.status.includes("REFUND"));

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Merchant overview"
        description="Live payment intents for the connected merchant wallet"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/app/merchant/onboard">Onboarding</Link>
            </Button>
            <Button asChild>
              <Link href="/app/merchant/intents/new">
                <Plus className="h-4 w-4" /> New payment link
              </Link>
            </Button>
          </>
        }
      />

      <WalletGate>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Listed intents" value={String(items.length)} />
          <MetricCard label="Settled / refunded" value={String(settled.length)} />
          <MetricCard label="Pending (CREATED)" value={String(pending.length)} />
          <MetricCard label="Refund rows" value={String(refunds.length)} />
        </div>

        {loading ? <Skeleton className="h-40 w-full" /> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent payment links</CardTitle>
              <CardDescription>Bounded event scan — open detail for refunds and receipts</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {items.length === 0 && !loading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No intents yet. Create a payment link to start.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.slice(0, 8).map((i) => (
                    <TableRow key={i.intentId}>
                      <TableCell>{i.orderRef}</TableCell>
                      <TableCell className="tabular">{i.amountUsdt} USDT</TableCell>
                      <TableCell>
                        <StatusBadge status={i.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/app/merchant/intents/${i.intentId}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </WalletGate>
    </div>
  );
}
