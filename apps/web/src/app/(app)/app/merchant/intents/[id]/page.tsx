"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { maxUint256 } from "viem";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddressText } from "@/components/shared/address";
import { TransactionStatus } from "@/components/shared/tx-status";
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
import { usdtToBase } from "@/lib/web3/format";
import { humanizeWeb3Error } from "@/lib/web3/errors";
import { usePaymentIntent } from "@/lib/web3/hooks/use-payment-intent";
import { waitSoftReceipt } from "@/lib/web3/tx";

const refundSchema = z.object({
  amountUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
});

export default function IntentDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: intent, loading, error, refresh } = usePaymentIntent(params.id);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [refundMsg, setRefundMsg] = useState<string | null>(null);
  const form = useForm<z.infer<typeof refundSchema>>({
    resolver: zodResolver(refundSchema),
    defaultValues: { amountUsdt: "0" },
  });

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error || !intent) {
    return <ErrorState description={error || "Intent not found"} onRetry={() => void refresh()} />;
  }

  const paid = BigInt(intent.paidAmountBase || "0");
  const refunded = BigInt(intent.refundedAmountBase || "0");
  const remaining = paid > refunded ? paid - refunded : 0n;
  const refundPct = paid > 0n ? Number((refunded * 10000n) / paid) / 100 : 0;
  const canRefund =
    remaining > 0n &&
    (intent.status === "SETTLED" || intent.status === "PARTIALLYREFUNDED" || intent.status === "PARTIALLY_REFUNDED");

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={`Payment ${intent.orderRef}`}
        description={`Intent #${intent.intentId}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
            <Button asChild variant="outline">
              <Link href={`/pay/${intent.intentId}`}>Checkout</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/pay/${intent.intentId}/receipt`}>Receipt</Link>
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
              <div className="tabular text-lg font-semibold">{intent.amountUsdt} USDT</div>
            </div>
            <div>
              <div className="text-muted-foreground">Status</div>
              <StatusBadge status={intent.status} />
            </div>
            <div>
              <div className="text-muted-foreground">Payer</div>
              {intent.payerSettled || intent.payer ? (
                <AddressText address={(intent.payerSettled || intent.payer)!} />
              ) : (
                "Any wallet"
              )}
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
              {intent.txHash && intent.explorerUrl ? (
                <a
                  className="font-mono text-xs text-primary underline"
                  href={intent.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {intent.txHash.slice(0, 18)}…
                </a>
              ) : (
                "—"
              )}
            </div>
            <div>
              <div className="text-muted-foreground">Expires</div>
              {new Date(intent.expiresAt * 1000).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Refunds</CardTitle>
            <CardDescription>
              Refunded {intent.refundedAmountBase} / paid {intent.paidAmountBase} (base units)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-warning" style={{ width: `${refundPct}%` }} />
            </div>
            <WalletGate title="Connect merchant wallet to refund">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={!canRefund || isPending}>
                    Refund
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Refund payment</DialogTitle>
                    <DialogDescription>
                      Merchant must hold USDT and approve PaymentProcessor. Broadcasts refund().
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    className="space-y-3"
                    onSubmit={form.handleSubmit(async (values) => {
                      setRefundMsg(null);
                      try {
                        if (!address || !publicClient) throw new Error("Wallet not ready");
                        const amount = usdtToBase(values.amountUsdt);
                        if (amount > remaining) throw new Error("Amount exceeds refundable balance");
                        const allowance = (await publicClient.readContract({
                          address: contracts.usdt.address,
                          abi: contracts.usdt.abi,
                          functionName: "allowance",
                          args: [address, contracts.paymentProcessor.address],
                        })) as bigint;
                        if (allowance < amount) {
                          const approveHash = await writeContractAsync({
                            address: contracts.usdt.address,
                            abi: contracts.usdt.abi,
                            functionName: "approve",
                            args: [contracts.paymentProcessor.address, maxUint256],
                          });
                          await waitSoftReceipt(approveHash);
                        }
                        const hash = await writeContractAsync({
                          address: contracts.paymentProcessor.address,
                          abi: contracts.paymentProcessor.abi,
                          functionName: "refund",
                          args: [BigInt(intent.intentId), amount],
                        });
                        await waitSoftReceipt(hash);
                        await refresh();
                        setRefundMsg(`Refund submitted: ${hash}`);
                      } catch (err) {
                        setRefundMsg(humanizeWeb3Error(err));
                      }
                    })}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="amountUsdt">Amount (USDT)</Label>
                      <Input id="amountUsdt" className="tabular" {...form.register("amountUsdt")} />
                    </div>
                    <Button type="submit" disabled={isPending}>
                      Confirm refund
                    </Button>
                    {refundMsg ? <p className="text-xs text-muted-foreground break-all">{refundMsg}</p> : null}
                  </form>
                </DialogContent>
              </Dialog>
            </WalletGate>
          </CardContent>
        </Card>
      </div>

      <TransactionStatus
        current={
          intent.status === "SETTLED" || intent.status.includes("REFUND")
            ? intent.confirmationStage === "finalized"
              ? "Finalized"
              : intent.confirmationStage === "safe"
                ? "Safe"
                : "Soft confirmed"
            : "Idle"
        }
      />
    </div>
  );
}
