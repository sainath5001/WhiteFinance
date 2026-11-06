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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, ApiClientError, type InvoiceDto } from "@/lib/api/client";

export default function SellerOverviewPage() {
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
        `/api/v1/invoices?seller=${address}&limit=40`,
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
        title="Seller overview"
        description="Invoices for the connected wallet (bounded event scan)"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
            <Button asChild>
              <Link href="/app/seller/invoices/new">
                <Plus className="h-4 w-4" /> New invoice
              </Link>
            </Button>
          </>
        }
      />
      <WalletGate title="Connect seller wallet">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="Open invoices"
            value={String(items.filter((i) => i.status !== "SETTLED" && i.status !== "PAID").length)}
          />
          <MetricCard
            label="Buyer confirmed"
            value={String(
              items.filter(
                (i) => i.status === "BUYER_CONFIRMED" || i.status === "BUYERCONFIRMED",
              ).length,
            )}
          />
          <MetricCard label="Listed" value={String(items.length)} />
        </div>
        {loading ? <Skeleton className="h-40 w-full" /> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 && !loading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No invoices found for this seller in the scan window. Create one to start.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Id</TableHead>
                    <TableHead>Face</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((inv) => (
                    <TableRow key={inv.invoiceId}>
                      <TableCell className="font-medium">#{inv.invoiceId}</TableCell>
                      <TableCell className="tabular">{inv.faceValueUsdt} USDT</TableCell>
                      <TableCell>{new Date(inv.dueDate * 1000).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/app/seller/invoices/${inv.invoiceId}`}>Open</Link>
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
