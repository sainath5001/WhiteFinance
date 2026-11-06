"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddressText } from "@/components/shared/address";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDemoInvoice, getDemoSellerFinancing } from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

const factorSchema = z
  .object({
    advanceUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
    discountUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
  })
  .superRefine((v, ctx) => {
    // preview only; live rule advance+discount==face enforced later
    if (Number(v.advanceUsdt) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Advance must be > 0", path: ["advanceUsdt"] });
    }
  });

export default function SellerInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoice = getDemoInvoice(params.id);
  const financing = invoice?.sellerFinancingId
    ? getDemoSellerFinancing(invoice.sellerFinancingId)
    : null;
  const form = useForm<z.infer<typeof factorSchema>>({
    resolver: zodResolver(factorSchema),
    defaultValues: {
      advanceUsdt: invoice ? String(invoice.faceValueUsdt * 0.95) : "0",
      discountUsdt: invoice ? String(invoice.faceValueUsdt * 0.05) : "0",
    },
  });
  const advance = Number(form.watch("advanceUsdt") || 0);
  const discount = Number(form.watch("discountUsdt") || 0);

  if (!invoice) {
    return <ErrorState title="Invoice not found" description="No demo fixture for this id." />;
  }

  const steps = ["CREATED", "BUYER_CONFIRMED", "FINANCED", "SETTLED"];
  const stepIndex =
    invoice.status === "CREATED"
      ? 0
      : invoice.status === "BUYER_CONFIRMED"
        ? financing
          ? 2
          : 1
        : invoice.status === "SETTLED"
          ? 3
          : 1;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={invoice.number}
        description={`Invoice #${invoice.id} · demo fixture`}
        actions={
          <Button asChild variant="outline">
            <Link href="/app/seller/financing">Seller financing</Link>
          </Button>
        }
      />

      <ol className="grid gap-2 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`rounded-md border px-3 py-2 text-center text-xs ${
              i <= stepIndex ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            {s}
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Face</span>
              <span className="tabular font-semibold">{formatUsdt(invoice.faceValueUsdt, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={invoice.status} />
            </div>
            <div>
              <div className="text-muted-foreground">Buyer</div>
              <AddressText address={invoice.buyer} />
            </div>
            <div>
              <div className="text-muted-foreground">Due</div>
              {invoice.dueDate}
            </div>
            <div>
              <div className="text-muted-foreground">Document hash</div>
              <div className="break-all font-mono text-[11px]">{invoice.documentHash}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request seller factoring</CardTitle>
            <CardDescription>
              Requires buyer confirmation. Not a guaranteed return for investors.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invoice.status !== "BUYER_CONFIRMED" ? (
              <p className="text-sm text-muted-foreground">
                Financing locked until buyer confirms.
              </p>
            ) : financing ? (
              <div className="space-y-2 text-sm">
                <StatusBadge status={financing.status} />
                <p>
                  Advance {formatUsdt(financing.advanceUsdt, 0)} · expected gross repayment{" "}
                  {formatUsdt(financing.expectedGrossRepaymentUsdt, 0)}
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/app/investor/seller/${financing.id}`}>View position</Link>
                </Button>
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={form.handleSubmit(() => {
                  window.alert("Demo only: factoring request validated.");
                })}
              >
                <div className="space-y-2">
                  <Label>Advance (USDT)</Label>
                  <Input className="tabular" {...form.register("advanceUsdt")} />
                </div>
                <div className="space-y-2">
                  <Label>Discount (USDT)</Label>
                  <Input className="tabular" {...form.register("discountUsdt")} />
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                  Investor expected gross repayment (face): {formatUsdt(advance + discount, 0)}
                  <br />
                  Investor profit if repaid (discount): {formatUsdt(discount, 0)}
                  <br />
                  Not a guaranteed return.
                </div>
                <Button type="submit">Validate financing request</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
