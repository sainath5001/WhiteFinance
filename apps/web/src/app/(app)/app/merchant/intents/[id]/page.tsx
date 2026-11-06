"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddressText } from "@/components/shared/address";
import { TransactionStatus } from "@/components/shared/tx-status";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getDemoIntent } from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

const refundSchema = z.object({
  amountUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
});

export default function IntentDetailPage() {
  const params = useParams<{ id: string }>();
  const intent = getDemoIntent(params.id);
  const form = useForm<z.infer<typeof refundSchema>>({
    resolver: zodResolver(refundSchema),
    defaultValues: { amountUsdt: intent ? String(intent.amountUsdt - intent.refundedUsdt) : "0" },
  });

  if (!intent) {
    return (
      <ErrorState
        title="Intent not found"
        description="No demo fixture matches this id."
      />
    );
  }

  const remaining = intent.amountUsdt - intent.refundedUsdt;
  const refundPct = intent.amountUsdt ? (intent.refundedUsdt / intent.amountUsdt) * 100 : 0;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={`Payment ${intent.orderRef}`}
        description={`Intent #${intent.id} · demo fixture`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/pay/${intent.id}`}>Open checkout</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/pay/${intent.id}/receipt`}>Receipt</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-muted-foreground">Amount</div>
              <div className="tabular text-lg font-semibold">{formatUsdt(intent.amountUsdt)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Status</div>
              <StatusBadge status={intent.status} />
            </div>
            <div>
              <div className="text-muted-foreground">Payer</div>
              {intent.payer ? <AddressText address={intent.payer} /> : "Any wallet"}
            </div>
            <div>
              <div className="text-muted-foreground">Confirmation</div>
              {intent.confirmationStage ? (
                <StatusBadge status={intent.confirmationStage} />
              ) : (
                "—"
              )}
            </div>
            <div>
              <div className="text-muted-foreground">Tx</div>
              {intent.txHash ? (
                <span className="font-mono text-xs">{intent.txHash.slice(0, 18)}…</span>
              ) : (
                "—"
              )}
            </div>
            <div>
              <div className="text-muted-foreground">Expires</div>
              {new Date(intent.expiresAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Refunds</CardTitle>
            <CardDescription>
              Refunded {formatUsdt(intent.refundedUsdt)} of {formatUsdt(intent.amountUsdt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-warning" style={{ width: `${refundPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Remaining refundable: {formatUsdt(remaining)}</p>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={remaining <= 0 || intent.status === "CREATED" || intent.status === "EXPIRED"}
                >
                  Refund
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Refund payment</DialogTitle>
                  <DialogDescription>
                    Demo confirmation only. Live refund() requires merchant USDT and is not wired yet.
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-3"
                  onSubmit={form.handleSubmit(() => {
                    window.alert("Demo only: refund form validated. No chain write.");
                  })}
                >
                  <div className="space-y-2">
                    <Label htmlFor="amountUsdt">Amount (USDT)</Label>
                    <Input id="amountUsdt" className="tabular" {...form.register("amountUsdt")} />
                  </div>
                  <Button type="submit">Confirm refund (demo)</Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      <TransactionStatus
        current={intent.status === "SETTLED" || intent.status.includes("REFUND") ? "Safe" : "Idle"}
        note="Soft confirmation is not final. This UI never marks success from local state alone."
      />

      <Card>
        <CardHeader>
          <CardTitle>API integration</CardTitle>
          <CardDescription>Endpoints merchants will call after wallet integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-xs text-muted-foreground">
          <div>GET /api/v1/payments/intents/{intent.id}</div>
          <div>GET /api/v1/payments/intents/{intent.id}/receipt</div>
          <div>POST /api/v1/payments/verify</div>
          <div>POST /api/v1/payments/intents/{intent.id}/refund/prepared</div>
        </CardContent>
      </Card>
    </div>
  );
}
