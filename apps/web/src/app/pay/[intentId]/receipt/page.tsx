"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DemoBanner } from "@/components/shared/demo-banner";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDemoIntent } from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

export default function ReceiptPage() {
  const params = useParams<{ intentId: string }>();
  const intent = getDemoIntent(params.intentId) ?? getDemoIntent("12");

  if (!intent) {
    return (
      <div className="min-h-screen">
        <DemoBanner />
        <p className="p-8 text-center text-sm text-muted-foreground">Receipt unavailable</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <DemoBanner />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-10">
        <Button asChild variant="outline" size="sm">
          <Link href={`/pay/${intent.id}`}>Back to checkout</Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Payment receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order</span>
              <span>{intent.orderRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span className="tabular font-semibold">{formatUsdt(intent.amountUsdt)}</span>
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
              <div className="break-all font-mono text-xs">{intent.txHash ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Refunds</div>
              <div className="tabular">{formatUsdt(intent.refundedUsdt)}</div>
            </div>
            <p className="text-xs text-muted-foreground">
              Glossary: soft = included on tip; safe / finalized = stronger confirmation tags when the
              RPC provides them. Soft is never irreversible.
            </p>
            <p className="text-xs text-warning">Demo fixture receipt — not a live explorer proof.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
