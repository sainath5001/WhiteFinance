"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOpenFinancing } from "@/lib/web3/hooks/use-financing";
import { baseToUsdt } from "@/lib/web3/format";

export default function OpportunitiesPage() {
  const { data, loading, error, refresh } = useOpenFinancing();

  const open = [
    ...(data?.seller || []).map((f) => ({
      type: "seller" as const,
      id: f.financingId,
      invoiceId: f.invoiceId,
      face: f.faceValueUsdt,
      advanceOrPrincipal: baseToUsdt(f.advanceAmountBase),
      discountOrFee: baseToUsdt(f.discountAmountBase),
      due: f.dueDate,
      status: f.status,
    })),
    ...(data?.buyer || []).map((f) => ({
      type: "buyer" as const,
      id: f.financingId,
      invoiceId: f.invoiceId,
      face: baseToUsdt(f.faceValueBase),
      advanceOrPrincipal: baseToUsdt(f.principalBase),
      discountOrFee: baseToUsdt(f.feeBase),
      due: f.dueDate,
      status: f.status,
    })),
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Open financing requests"
        description="Live REQUESTED positions from SellerFinancing / BuyerFinancing. No guaranteed returns."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Refresh
          </Button>
        }
      />
      {loading ? <Skeleton className="h-40 w-full" /> : null}
      {error ? <ErrorState description={error} onRetry={() => void refresh()} /> : null}
      {!loading && !error ? (
        <Card>
          <CardContent className="pt-5">
            {open.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No open REQUESTED financing found in the recent event scan window.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Face</TableHead>
                    <TableHead>Advance / principal</TableHead>
                    <TableHead>Discount / fee</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {open.map((f) => (
                    <TableRow key={`${f.type}-${f.id}`}>
                      <TableCell className="capitalize">{f.type}</TableCell>
                      <TableCell>#{f.invoiceId}</TableCell>
                      <TableCell className="tabular">{f.face} USDT</TableCell>
                      <TableCell className="tabular">{f.advanceOrPrincipal} USDT</TableCell>
                      <TableCell className="tabular">{f.discountOrFee} USDT</TableCell>
                      <TableCell>{new Date(f.due * 1000).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <StatusBadge status={f.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm">
                          <Link href={`/app/investor/${f.type}/${f.id}`}>Review</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
