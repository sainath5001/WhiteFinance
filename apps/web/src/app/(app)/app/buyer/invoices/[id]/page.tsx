"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseEventLogs } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ErrorState } from "@/components/shared/error-state";
import { WalletGate } from "@/components/shared/wallet-gate";
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
import { Skeleton } from "@/components/ui/skeleton";
import { contracts } from "@/lib/web3/contracts";
import { usdtToBase, baseToUsdt } from "@/lib/web3/format";
import { humanizeWeb3Error } from "@/lib/web3/errors";
import { useInvoice } from "@/lib/web3/hooks/use-invoice";
import { buyerFinancingPreview } from "@/lib/web3/accounting";
import { ensureUsdtAllowance } from "@/lib/web3/approve";
import { waitSoftReceipt } from "@/lib/web3/tx";
import { explorerTx } from "@/lib/config";
import type { BuyerFinancingDto, SellerFinancingDto } from "@/lib/api/client";

const requestSchema = z.object({
  principalUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
  feeUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
  fundingHours: z.string().regex(/^\d+$/),
});

export default function BuyerInvoicePage() {
  const params = useParams<{ id: string }>();
  const { data: invoice, loading, error, refresh } = useInvoice(params.id);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [msg, setMsg] = useState<string | null>(null);
  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { principalUsdt: "30000", feeUsdt: "1500", fundingHours: "72" },
  });

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error || !invoice) {
    return <ErrorState description={error || "Invoice not found"} onRetry={() => void refresh()} />;
  }

  const financing =
    invoice.buyerFinancing && "financingId" in invoice.buyerFinancing
      ? (invoice.buyerFinancing as BuyerFinancingDto)
      : null;
  const sellerFinancing =
    invoice.sellerFinancing && "financingId" in invoice.sellerFinancing
      ? (invoice.sellerFinancing as SellerFinancingDto)
      : null;
  const face = BigInt(invoice.faceValueBase);
  const principalWatch = usdtToBase(form.watch("principalUsdt") || "0");
  const feeWatch = usdtToBase(form.watch("feeUsdt") || "0");
  const preview = buyerFinancingPreview(face, principalWatch, feeWatch);

  const principal = financing ? BigInt(financing.principalBase) : 0n;
  const fee = financing ? BigInt(financing.feeBase) : 0n;
  const remainder = financing
    ? BigInt(financing.sellerRemainderBase)
    : BigInt(invoice.outstandingToSellerBase);

  async function runTx(label: string, fn: () => Promise<`0x${string}`>) {
    setMsg(null);
    try {
      const hash = await fn();
      await waitSoftReceipt(hash);
      setMsg(`${label}: ${hash}`);
      await refresh();
    } catch (err) {
      setMsg(humanizeWeb3Error(err));
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={`Invoice #${invoice.invoiceId}`}
        description="Buyer view · onchain state"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Confirm invoice</CardTitle>
            <CardDescription>
              Broadcasts InvoiceRegistry.confirmInvoice. Not a legal admission offchain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBadge status={invoice.status} />
            <WalletGate>
              <Dialog>
                <DialogTrigger asChild>
                  <Button disabled={invoice.status !== "CREATED" || isPending}>
                    Confirm invoice
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm invoice?</DialogTitle>
                    <DialogDescription>
                      You are the buyer onchain. This moves the invoice to BUYER_CONFIRMED.
                    </DialogDescription>
                  </DialogHeader>
                  <Button
                    disabled={isPending}
                    onClick={() =>
                      void runTx("Confirmed", () =>
                        writeContractAsync({
                          address: contracts.invoiceRegistry.address,
                          abi: contracts.invoiceRegistry.abi,
                          functionName: "confirmInvoice",
                          args: [BigInt(invoice.invoiceId)],
                        }),
                      )
                    }
                  >
                    Confirm onchain
                  </Button>
                </DialogContent>
              </Dialog>
            </WalletGate>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accounting panel</CardTitle>
            <CardDescription>Do not double-count principal as still owed to seller.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-sm">
            <Row label="Invoice face" value={`${invoice.faceValueUsdt} USDT`} />
            <Row label="Paid to seller by investor" value={`${baseToUsdt(principal)} USDT`} />
            <Row label="Still owed to seller" value={`${baseToUsdt(remainder)} USDT`} />
            <Row
              label="Owed to investor (principal + fee)"
              value={`${baseToUsdt(principal + fee)} USDT`}
            />
          </CardContent>
        </Card>
      </div>

      {sellerFinancing ? (
        <Card>
          <CardHeader>
            <CardTitle>Seller factoring repayment</CardTitle>
            <CardDescription>
              Buyer repays face value to investor. Expected gross = face, not a guaranteed return.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <StatusBadge status={sellerFinancing.status} />
            <p>
              Advance {baseToUsdt(sellerFinancing.advanceAmountBase)} · repay{" "}
              {sellerFinancing.accounting.investorReceivesOnRepay} USDT
            </p>
            <WalletGate>
              <Button
                variant="outline"
                disabled={
                  isPending || sellerFinancing.repaid || sellerFinancing.status !== "ACTIVE"
                }
                onClick={() =>
                  void runTx("Seller factoring repaid", async () => {
                    if (!address || !publicClient) throw new Error("Wallet not ready");
                    await ensureUsdtAllowance({
                      publicClient,
                      owner: address,
                      spender: contracts.sellerFinancing.address,
                      amount: BigInt(sellerFinancing.faceValueBase),
                      writeContractAsync: writeContractAsync as never,
                    });
                    return writeContractAsync({
                      address: contracts.sellerFinancing.address,
                      abi: contracts.sellerFinancing.abi,
                      functionName: "repay",
                      args: [BigInt(sellerFinancing.financingId)],
                    });
                  })
                }
              >
                Repay investor (seller factoring)
              </Button>
            </WalletGate>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Buyer financing</CardTitle>
          <CardDescription>
            Principal must be less than face. Fee is fixed USDT, not a yield promise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WalletGate>
            {financing ? (
              <div className="space-y-3 text-sm">
                <StatusBadge status={financing.status} />
                <p>
                  Principal {baseToUsdt(financing.principalBase)} · fee{" "}
                  {baseToUsdt(financing.feeBase)} · investor receivable{" "}
                  {financing.accounting.investorReceivable} USDT
                </p>
                <p className="text-xs text-muted-foreground">{financing.accounting.note}</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/app/investor/buyer/${financing.financingId}`}>View position</Link>
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isPending || financing.investorRepaid || financing.status !== "ACTIVE"}
                    onClick={() =>
                      void runTx("Repay investor", async () => {
                        if (!address || !publicClient) throw new Error("Wallet not ready");
                        const amount = BigInt(financing.principalBase) + BigInt(financing.feeBase);
                        await ensureUsdtAllowance({
                          publicClient,
                          owner: address,
                          spender: contracts.buyerFinancing.address,
                          amount,
                          writeContractAsync: writeContractAsync as never,
                        });
                        return writeContractAsync({
                          address: contracts.buyerFinancing.address,
                          abi: contracts.buyerFinancing.abi,
                          functionName: "repay",
                          args: [BigInt(financing.financingId)],
                        });
                      })
                    }
                  >
                    Repay investor
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      isPending || financing.remainderPaid || financing.status !== "ACTIVE"
                    }
                    onClick={() =>
                      void runTx("Pay seller remainder", async () => {
                        if (!address || !publicClient) throw new Error("Wallet not ready");
                        const amount = BigInt(financing.sellerRemainderBase);
                        await ensureUsdtAllowance({
                          publicClient,
                          owner: address,
                          spender: contracts.buyerFinancing.address,
                          amount,
                          writeContractAsync: writeContractAsync as never,
                        });
                        return writeContractAsync({
                          address: contracts.buyerFinancing.address,
                          abi: contracts.buyerFinancing.abi,
                          functionName: "payRemainder",
                          args: [BigInt(financing.financingId)],
                        });
                      })
                    }
                  >
                    Pay seller remainder
                  </Button>
                </div>
              </div>
            ) : (
              <form
                className="grid max-w-md gap-3"
                onSubmit={form.handleSubmit(async (values) => {
                  setMsg(null);
                  try {
                    const principal = usdtToBase(values.principalUsdt);
                    const fee = usdtToBase(values.feeUsdt);
                    const p = buyerFinancingPreview(face, principal, fee);
                    if (!p.invariantOk) {
                      throw new Error("Principal must be less than face; fee must be >= 0");
                    }
                    const deadline =
                      BigInt(Math.floor(Date.now() / 1000)) +
                      BigInt(Number(values.fundingHours) * 3600);
                    const hash = await writeContractAsync({
                      address: contracts.buyerFinancing.address,
                      abi: contracts.buyerFinancing.abi,
                      functionName: "requestFinancing",
                      args: [BigInt(invoice.invoiceId), principal, fee, deadline],
                    });
                    const receipt = await waitSoftReceipt(hash);
                    const logs = parseEventLogs({
                      abi: contracts.buyerFinancing.abi,
                      logs: receipt.logs,
                      eventName: "FinancingRequested",
                    });
                    const financingId = (
                      logs[0]?.args as { financingId?: bigint } | undefined
                    )?.financingId;
                    setMsg(
                      financingId != null
                        ? `Buyer financing #${financingId.toString()} · ${hash}`
                        : hash,
                    );
                    await refresh();
                  } catch (err) {
                    setMsg(humanizeWeb3Error(err));
                  }
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
                <div className="space-y-2">
                  <Label>Funding window (hours)</Label>
                  <Input className="tabular" {...form.register("fundingHours")} />
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                  Seller remainder: {baseToUsdt(preview.sellerRemainder)} USDT
                  <br />
                  Buyer obligation to investor: {baseToUsdt(preview.buyerObligationToInvestor)} USDT
                  <br />
                  {preview.disclaimer}
                </div>
                <Button
                  type="submit"
                  disabled={
                    isPending ||
                    (invoice.status !== "BUYER_CONFIRMED" && invoice.status !== "BUYERCONFIRMED") ||
                    !preview.invariantOk
                  }
                >
                  Request buyer financing onchain
                </Button>
              </form>
            )}
            {msg ? (
              <p className="mt-3 break-all text-xs text-muted-foreground">
                {msg.includes("0x") ? (
                  <a
                    className="underline"
                    href={explorerTx((msg.match(/0x[a-fA-F0-9]{64}/)?.[0] || "0x") as `0x${string}`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {msg}
                  </a>
                ) : (
                  msg
                )}
              </p>
            ) : null}
          </WalletGate>
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
