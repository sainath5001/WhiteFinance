"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { MetricCard } from "@/components/shared/metric-card";
import { WalletGate } from "@/components/shared/wallet-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, ApiClientError, type InvoiceDto } from "@/lib/api/client";
import { baseToUsdt } from "@/lib/web3/format";

export default function BuyerDashboardPage() {
  const { address } = useAccount();
  const [items, setItems] = useState<InvoiceDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ items: InvoiceDto[] }>(
        `/api/v1/invoices?buyer=${address}&limit=40`,
      );
      setItems(res.items || []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load invoices");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Buyer workspace"
        description="Invoices addressed to the connected wallet"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Refresh
          </Button>
        }
      />
      <WalletGate title="Connect buyer wallet">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="To confirm"
            value={String(items.filter((i) => i.status === "CREATED").length)}
          />
          <MetricCard
            label="Still owed to sellers"
            value={`${items
              .reduce((s, i) => s + Number(baseToUsdt(i.outstandingToSellerBase)), 0)
              .toLocaleString()} USDT`}
          />
          <MetricCard label="Inbox" value={String(items.length)} />
        </div>
        {loading ? <Skeleton className="h-40 w-full" /> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Card>
          <CardHeader>
            <CardTitle>Received invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 && !loading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No invoices for this buyer in the scan window.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Id</TableHead>
                    <TableHead>Face</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((inv) => (
                    <TableRow key={inv.invoiceId}>
                      <TableCell>#{inv.invoiceId}</TableCell>
                      <TableCell className="tabular">{inv.faceValueUsdt} USDT</TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/app/buyer/invoices/${inv.invoiceId}`}>Open</Link>
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
