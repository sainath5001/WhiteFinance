"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseEventLogs } from "viem";
import { useWriteContract } from "wagmi";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddressText } from "@/components/shared/address";
import { ErrorState } from "@/components/shared/error-state";
import { WalletGate } from "@/components/shared/wallet-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { contracts } from "@/lib/web3/contracts";
import { usdtToBase, baseToUsdt } from "@/lib/web3/format";
import { humanizeWeb3Error } from "@/lib/web3/errors";
import { useInvoice } from "@/lib/web3/hooks/use-invoice";
import { sellerFactoringPreview } from "@/lib/web3/accounting";
import { waitSoftReceipt } from "@/lib/web3/tx";
import { explorerTx } from "@/lib/config";

const factorSchema = z.object({
  advanceUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
  discountUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
  fundingHours: z.string().regex(/^\d+$/),
});

export default function SellerInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: invoice, loading, error, refresh } = useInvoice(params.id);
  const { writeContractAsync, isPending } = useWriteContract();
  const [txMsg, setTxMsg] = useState<string | null>(null);
  const form = useForm<z.infer<typeof factorSchema>>({
    resolver: zodResolver(factorSchema),
    defaultValues: { advanceUsdt: "95000", discountUsdt: "5000", fundingHours: "72" },
  });

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error || !invoice) {
    return <ErrorState description={error || "Invoice not found"} onRetry={() => void refresh()} />;
  }

  const face = BigInt(invoice.faceValueBase);
  const advance = usdtToBase(form.watch("advanceUsdt") || "0");
  const discount = usdtToBase(form.watch("discountUsdt") || "0");
  const preview = sellerFactoringPreview(face, advance, discount);
  const steps = ["CREATED", "BUYER_CONFIRMED", "FINANCED", "SETTLED"];
  const stepIndex =
    invoice.status === "CREATED"
      ? 0
      : invoice.status === "BUYER_CONFIRMED"
        ? invoice.sellerFinancingId
          ? 2
          : 1
        : invoice.status === "SETTLED" || invoice.status === "PAID"
          ? 3
          : 1;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={`Invoice #${invoice.invoiceId}`}
        description="Onchain InvoiceRegistry state"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/seller/financing">Seller financing</Link>
            </Button>
          </>
        }
      />

      <ol className="grid gap-2 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`rounded-md border px-3 py-2 text-center text-xs ${
              i <= stepIndex
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
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
              <span className="tabular font-semibold">{invoice.faceValueUsdt} USDT</span>
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
              {new Date(invoice.dueDate * 1000).toLocaleString()}
            </div>
            <div>
              <div className="text-muted-foreground">Document hash</div>
              <div className="break-all font-mono text-[11px]">{invoice.documentHash}</div>
              <p className="mt-1 text-xs text-muted-foreground">{invoice.authenticityNote}</p>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outstanding to seller</span>
              <span className="tabular">{baseToUsdt(invoice.outstandingToSellerBase)} USDT</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request seller factoring</CardTitle>
            <CardDescription>
              advance + discount must equal face. Not a guaranteed investor return.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WalletGate>
              {invoice.status !== "BUYER_CONFIRMED" && invoice.status !== "BUYERCONFIRMED" ? (
                <p className="text-sm text-muted-foreground">
                  Financing locked until buyer confirms onchain.
                </p>
              ) : invoice.sellerFinancingId ? (
                <div className="space-y-2 text-sm">
                  <p>Seller financing #{invoice.sellerFinancingId}</p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/app/investor/seller/${invoice.sellerFinancingId}`}>
                      View position
                    </Link>
                  </Button>
                </div>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={form.handleSubmit(async (values) => {
                    setTxMsg(null);
                    try {
                      const adv = usdtToBase(values.advanceUsdt);
                      const disc = usdtToBase(values.discountUsdt);
                      if (adv + disc !== face) {
                        throw new Error(
                          `advance + discount must equal face (${invoice.faceValueUsdt} USDT)`,
                        );
                      }
                      const deadline =
                        BigInt(Math.floor(Date.now() / 1000)) +
                        BigInt(Number(values.fundingHours) * 3600);
                      const hash = await writeContractAsync({
                        address: contracts.sellerFinancing.address,
                        abi: contracts.sellerFinancing.abi,
                        functionName: "requestFinancing",
                        args: [BigInt(invoice.invoiceId), adv, disc, deadline],
                      });
                      const receipt = await waitSoftReceipt(hash);
                      const logs = parseEventLogs({
                        abi: contracts.sellerFinancing.abi,
                        logs: receipt.logs,
                        eventName: "FinancingRequested",
                      });
                      const financingId = (
                        logs[0]?.args as { financingId?: bigint } | undefined
                      )?.financingId;
                      setTxMsg(
                        financingId != null
                          ? `Created financing #${financingId.toString()} · ${hash}`
                          : `Submitted · ${hash}`,
                      );
                      await refresh();
                    } catch (err) {
                      setTxMsg(humanizeWeb3Error(err));
                    }
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
                  <div className="space-y-2">
                    <Label>Funding window (hours)</Label>
                    <Input className="tabular" {...form.register("fundingHours")} />
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                    Investor expected gross repayment (face): {baseToUsdt(preview.expectedGrossRepaymentToInvestor)}{" "}
                    USDT
                    <br />
                    Investor profit if repaid (discount): {baseToUsdt(preview.investorProfitIfRepaid)} USDT
                    <br />
                    Invariant OK: {preview.invariantOk ? "yes" : "no"}
                    <br />
                    {preview.disclaimer}
                  </div>
                  <Button type="submit" disabled={isPending || !preview.invariantOk}>
                    Request financing onchain
                  </Button>
                </form>
              )}
              {txMsg ? (
                <p className="mt-3 break-all text-xs text-muted-foreground">
                  {txMsg.startsWith("0x") || txMsg.includes("0x") ? (
                    <a
                      className="underline"
                      href={explorerTx((txMsg.match(/0x[a-fA-F0-9]{64}/)?.[0] || "0x") as `0x${string}`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {txMsg}
                    </a>
                  ) : (
                    txMsg
                  )}
                </p>
              ) : null}
            </WalletGate>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
