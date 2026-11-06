"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseEventLogs } from "viem";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { PageHeader } from "@/components/shared/page-header";
import { WalletGate } from "@/components/shared/wallet-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contracts } from "@/lib/web3/contracts";
import { stringToBytes32 } from "@/lib/services/encode";
import { usdtToBase } from "@/lib/web3/format";
import { humanizeWeb3Error } from "@/lib/web3/errors";
import { waitSoftReceipt } from "@/lib/web3/tx";
import { TransactionStatus } from "@/components/shared/tx-status";
import { explorerTx } from "@/lib/config";

const schema = z.object({
  orderRef: z.string().min(1).max(64),
  amountUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid amount"),
  payer: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address")
    .or(z.literal(""))
    .optional(),
  expiresInMinutes: z.coerce.number().int().min(5).max(10080),
});

type FormValues = z.infer<typeof schema>;

export default function NewPaymentLinkPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [phase, setPhase] = useState<"idle" | "wallet" | "pending" | "soft" | "failed" | "rejected">("idle");
  const [result, setResult] = useState<{ intentId: string; txHash: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { orderRef: "", amountUsdt: "25.00", payer: "", expiresInMinutes: 30 },
  });

  return (
    <div className="mx-auto max-w-xl animate-fade-in space-y-6">
      <PageHeader
        title="Create payment link"
        description="Broadcasts PaymentProcessor.createIntent on Whitechain Sepolia."
      />
      <WalletGate title="Connect merchant wallet" description="Merchant must be registered onchain.">
        <Card>
          <CardHeader>
            <CardTitle>Payment intent</CardTitle>
            <CardDescription>Connected as {address}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setError(null);
                setResult(null);
                setPhase("wallet");
                try {
                  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + values.expiresInMinutes * 60);
                  const payer =
                    values.payer && values.payer.length > 0
                      ? (values.payer as `0x${string}`)
                      : ("0x0000000000000000000000000000000000000000" as const);
                  const hash = await writeContractAsync({
                    address: contracts.paymentProcessor.address,
                    abi: contracts.paymentProcessor.abi,
                    functionName: "createIntent",
                    args: [
                      stringToBytes32(values.orderRef),
                      usdtToBase(values.amountUsdt),
                      payer,
                      expiresAt,
                    ],
                  });
                  setPhase("pending");
                  const receipt = await waitSoftReceipt(hash);
                  if (receipt.status !== "success") {
                    setPhase("failed");
                    setError("createIntent transaction reverted");
                    return;
                  }
                  const logs = parseEventLogs({
                    abi: contracts.paymentProcessor.abi,
                    logs: receipt.logs,
                    eventName: "PaymentIntentCreated",
                  });
                  const intentId = (logs[0]?.args as { intentId?: bigint } | undefined)?.intentId;
                  if (intentId == null) {
                    setPhase("failed");
                    setError("PaymentIntentCreated event missing from receipt");
                    return;
                  }
                  setResult({ intentId: intentId.toString(), txHash: hash });
                  setPhase("soft");
                } catch (err) {
                  const msg = humanizeWeb3Error(err);
                  if (msg.includes("rejected")) setPhase("rejected");
                  else setPhase("failed");
                  setError(msg);
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="orderRef">Order reference</Label>
                <Input id="orderRef" {...register("orderRef")} />
                {errors.orderRef ? (
                  <p className="text-xs text-destructive">{errors.orderRef.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="amountUsdt">Amount (USDT)</Label>
                <Input id="amountUsdt" className="tabular" {...register("amountUsdt")} />
                {errors.amountUsdt ? (
                  <p className="text-xs text-destructive">{errors.amountUsdt.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="payer">Bound payer (optional)</Label>
                <Input id="payer" className="font-mono text-xs" placeholder="0x…" {...register("payer")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresInMinutes">Expires in (minutes)</Label>
                <Input id="expiresInMinutes" type="number" {...register("expiresInMinutes")} />
              </div>
              <Button type="submit" disabled={isPending || !publicClient}>
                Create intent onchain
              </Button>
            </form>

            <TransactionStatus
              current={
                phase === "wallet"
                  ? "Wallet prompt"
                  : phase === "pending"
                    ? "Pending"
                    : phase === "soft"
                      ? "Soft confirmed"
                      : phase === "failed"
                        ? "Failed"
                        : phase === "rejected"
                          ? "Rejected"
                          : "Idle"
              }
              note="Soft confirmation is not final. Intent id comes from PaymentIntentCreated."
            />

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {result ? (
              <div className="rounded-md border border-border bg-muted/30 p-4 text-sm space-y-2">
                <p>
                  Intent <span className="font-mono">#{result.intentId}</span> created
                </p>
                <a
                  className="text-primary underline font-mono text-xs break-all"
                  href={explorerTx(result.txHash as `0x${string}`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.txHash}
                </a>
                <div className="flex gap-2 pt-2">
                  <Button asChild size="sm">
                    <Link href={`/pay/${result.intentId}`}>Open checkout</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/merchant/intents/${result.intentId}`}>Merchant detail</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </WalletGate>
    </div>
  );
}
