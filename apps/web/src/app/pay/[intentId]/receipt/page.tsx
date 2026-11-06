"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DemoBanner } from "@/components/shared/demo-banner";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaymentIntent } from "@/lib/web3/hooks/use-payment-intent";

export default function ReceiptPage() {
  const params = useParams<{ intentId: string }>();
  const { data: intent, loading, error, refresh } = usePaymentIntent(params.intentId);

  return (
    <div className="min-h-screen">
      <DemoBanner />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-10">
        <Button asChild variant="outline" size="sm">
          <Link href={`/pay/${params.intentId}`}>Back to checkout</Link>
        </Button>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Payment receipt</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => void refresh()}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading ? <Skeleton className="h-32 w-full" /> : null}
            {error ? <p className="text-destructive">{error}</p> : null}
            {intent ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order</span>
                  <span>{intent.orderRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="tabular font-semibold">{intent.amountUsdt} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="tabular">{intent.paidAmountBase} base</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={intent.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confirmation</span>
                  {intent.confirmationStage ? (
                    <StatusBadge status={intent.confirmationStage} />
                  ) : (
                    "—"
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground">Tx hash</div>
                  {intent.txHash && intent.explorerUrl ? (
                    <a
                      className="break-all font-mono text-xs text-primary underline"
                      href={intent.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {intent.txHash}
                    </a>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Refunded</span>
                  <span className="tabular">{intent.refundedAmountBase} base</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Soft = tip inclusion. Safe/finalized = stronger tags when RPC provides them. Soft
                  is never irreversible. Values are from API chain reads.
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
