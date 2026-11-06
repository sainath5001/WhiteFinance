"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { getDemoBuyerFinancing, getDemoInvoice } from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

const requestSchema = z.object({
  principalUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
  feeUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
});

export default function BuyerInvoicePage() {
  const params = useParams<{ id: string }>();
  const invoice = getDemoInvoice(params.id);
  const financing = invoice?.buyerFinancingId
    ? getDemoBuyerFinancing(invoice.buyerFinancingId)
    : null;
  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { principalUsdt: "7500", feeUsdt: "375" },
  });

  if (!invoice) {
    return <ErrorState title="Invoice not found" description="No demo fixture for this id." />;
  }

  const principal = financing?.principalUsdt ?? 0;
  const fee = financing?.feeUsdt ?? 0;
  const remainder = financing?.sellerRemainderUsdt ?? invoice.outstandingToSeller;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title={invoice.number} description="Buyer invoice detail · demo fixture" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Confirm invoice</CardTitle>
            <CardDescription>
              You acknowledge this invoice for the demo. This is not a legal admission in the real world.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBadge status={invoice.status} />
            <Dialog>
              <DialogTrigger asChild>
                <Button disabled={invoice.status !== "CREATED"}>Confirm invoice (demo)</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm invoice?</DialogTitle>
                  <DialogDescription>
                    Demo confirmation dialog. Live confirmInvoice is not wired in this stage.
                  </DialogDescription>
                </DialogHeader>
                <Button
                  onClick={() => window.alert("Demo only: confirmation recorded in UI narrative.")}
                >
                  Confirm
                </Button>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accounting panel</CardTitle>
            <CardDescription>Do not double-count principal as still owed to seller.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-sm">
            <Row label="Invoice face" value={formatUsdt(invoice.faceValueUsdt, 0)} />
            <Row label="Paid to seller by investor" value={formatUsdt(principal, 0)} />
            <Row label="Still owed to seller" value={formatUsdt(remainder, 0)} />
            <Row label="Owed to investor (principal + fee)" value={formatUsdt(principal + fee, 0)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request buyer financing</CardTitle>
          <CardDescription>Principal must be less than face. Fee is fixed USDT, not a yield promise.</CardDescription>
        </CardHeader>
        <CardContent>
          {financing ? (
            <div className="space-y-2 text-sm">
              <StatusBadge status={financing.status} />
              <p>
                Principal {formatUsdt(financing.principalUsdt, 0)} · fee {formatUsdt(financing.feeUsdt, 0)} ·
                expected investor repayment {formatUsdt(financing.expectedGrossRepaymentUsdt, 0)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.alert("Demo only: repay investor not wired.")}
                >
                  Repay investor
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.alert("Demo only: pay remainder not wired.")}
                >
                  Pay seller remainder
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="grid max-w-md gap-3"
              onSubmit={form.handleSubmit(() => {
                window.alert("Demo only: buyer financing request validated.");
              })}
            >
              <div className="space-y-2">
                <Label>Principal (USDT)</Label>
                <Input className="tabular" {...form.register("principalUsdt")} />
              </div>
              <div className="space-y-2">
                <Label>Fee (USDT)</Label>
                <Input className="tabular" {...form.register("feeUsdt")} />
              </div>
              <Button type="submit" disabled={invoice.status !== "BUYER_CONFIRMED"}>
                Validate financing request
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
