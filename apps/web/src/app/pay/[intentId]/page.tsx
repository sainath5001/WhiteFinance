"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAccount, useSignTypedData, useWriteContract, usePublicClient } from "wagmi";
import { maxUint256 } from "viem";
import { DemoBanner } from "@/components/shared/demo-banner";
import { NetworkBanner } from "@/components/shared/network-banner";
import { AddressText } from "@/components/shared/address";
import { StatusBadge } from "@/components/shared/status-badge";
import { TransactionStatus } from "@/components/shared/tx-status";
import { WalletArea } from "@/components/shared/wallet-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  apiPost,
  type RelayerQuoteDto,
  type RelayerSubmitDto,
} from "@/lib/api/client";
import { config, explorerTx } from "@/lib/config";
import { contracts, assertPrizeUsdt } from "@/lib/web3/contracts";
import { humanizeWeb3Error } from "@/lib/web3/errors";
import { usePaymentIntent } from "@/lib/web3/hooks/use-payment-intent";
import { pollUntil, waitSoftReceipt } from "@/lib/web3/tx";
import { Skeleton } from "@/components/ui/skeleton";

type Phase = "review" | "wallet" | "pending" | "soft" | "failed" | "rejected";

export default function CheckoutPage() {
  const params = useParams<{ intentId: string }>();
  const intentId = params.intentId;
  const { data: intent, loading, error, refresh } = usePaymentIntent(intentId);
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  const [method, setMethod] = useState<"gasless" | "gasful">("gasless");
  const [phase, setPhase] = useState<Phase>("review");
  const [quote, setQuote] = useState<RelayerQuoteDto | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const blocked = useMemo(() => {
    if (!intent) return true;
    const s = intent.status.toUpperCase();
    return !["CREATED"].includes(s);
  }, [intent]);

  const tokenOk = intent ? assertPrizeUsdt(intent.token as `0x${string}`) : false;

  async function loadQuote() {
    if (!address || !intent) return;
    setMsg(null);
    try {
      const q = await apiPost<RelayerQuoteDto>("/api/v1/relayer/quote", {
        intentId: intent.intentId,
        payer: address,
      });
      setQuote(q);
      if (!q.available) {
        setMsg(
          `Gasless unavailable (${q.pauseReason || "unknown"}). Use Pay with gas — gasless will not auto-fallback.`,
        );
      }
    } catch (err) {
      setMsg(humanizeWeb3Error(err));
      setQuote(null);
    }
  }

  async function payGasless() {
    if (!address || !intent || !quote?.typedData || !quote.authorizationTemplate) {
      setMsg("Request a gasless quote first.");
      return;
    }
    if (!quote.available) {
      setMsg("Gasless relayer is unavailable. Switch to Pay with gas manually.");
      return;
    }
    setPhase("wallet");
    setMsg(null);
    try {
      const td = quote.typedData;
      const signature = await signTypedDataAsync({
        domain: td.domain,
        types: td.types,
        primaryType: td.primaryType,
        message: {
          from: quote.authorizationTemplate.from,
          to: quote.authorizationTemplate.to,
          value: BigInt(quote.authorizationTemplate.value),
          validAfter: BigInt(quote.authorizationTemplate.validAfter),
          validBefore: BigInt(quote.authorizationTemplate.validBefore),
          nonce: quote.authorizationTemplate.nonce,
        },
      } as Parameters<typeof signTypedDataAsync>[0]);
      setPhase("pending");
      const submitted = await apiPost<RelayerSubmitDto>("/api/v1/relayer/submit", {
        intentId: intent.intentId,
        authorization: {
          ...quote.authorizationTemplate,
          signature,
        },
        idempotencyKey: `${intent.intentId}:${quote.authorizationTemplate.nonce}`,
      });
      if (submitted.txHash) setTxHash(submitted.txHash);
      const verified = await pollUntil(
        () => refresh(),
        (v) => Boolean(v && v.status.toUpperCase() === "SETTLED"),
        { timeoutMs: 180_000 },
      );
      if (!verified || verified.status.toUpperCase() !== "SETTLED") {
        setPhase("failed");
        setMsg("Settlement not verified onchain/API. Do not treat as paid.");
        return;
      }
      setPhase("soft");
    } catch (err) {
      const text = humanizeWeb3Error(err);
      setMsg(text);
      setPhase(text.includes("rejected") ? "rejected" : "failed");
    }
  }

  async function payGasful() {
    if (!address || !intent || !publicClient) return;
    setPhase("wallet");
    setMsg(null);
    try {
      const amount = BigInt(intent.amountBase);
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
        setPhase("pending");
        await waitSoftReceipt(approveHash);
        setPhase("wallet");
      }
      const hash = await writeContractAsync({
        address: contracts.paymentProcessor.address,
        abi: contracts.paymentProcessor.abi,
        functionName: "pay",
        args: [BigInt(intent.intentId)],
      });
      setTxHash(hash);
      setPhase("pending");
      const receipt = await waitSoftReceipt(hash);
      if (receipt.status !== "success") {
        setPhase("failed");
        setMsg("Payment transaction reverted");
        return;
      }
      await apiPost("/api/v1/payments/verify", { txHash: hash, intentId: intent.intentId }).catch(
        () => null,
      );
      const verified = await pollUntil(
        () => refresh(),
        (v) => Boolean(v && v.status.toUpperCase() === "SETTLED"),
      );
      if (!verified) {
        setPhase("failed");
        setMsg("Payment not verified via API/chain");
        return;
      }
      setPhase("soft");
    } catch (err) {
      const text = humanizeWeb3Error(err);
      setMsg(text);
      setPhase(text.includes("rejected") ? "rejected" : "failed");
    }
  }

  return (
    <div className="min-h-screen">
      <DemoBanner />
      <NetworkBanner />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div>
          <div className="font-semibold">WhiteFinance Checkout</div>
          <div className="text-xs text-muted-foreground">Hosted payment · Whitechain Sepolia</div>
        </div>
        <WalletArea />
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 pb-16 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{intent?.merchantName || "Merchant"}</CardTitle>
            <CardDescription>
              {loading ? "Loading intent…" : intent ? `Order ${intent.orderRef}` : "Intent"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : error ? (
              <p className="text-destructive">{error}</p>
            ) : intent ? (
              <>
                <div>
                  <div className="text-muted-foreground">Amount</div>
                  <div className="tabular text-3xl font-semibold">{intent.amountUsdt} USDT</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Token</div>
                  <div>USDT · prize address</div>
                  <AddressText address={intent.token} />
                  {!tokenOk ? (
                    <p className="mt-1 text-xs text-destructive">
                      Token is not prize USDT. Refusing checkout.
                    </p>
                  ) : null}
                </div>
                <div>
                  <div className="text-muted-foreground">Payout</div>
                  <AddressText address={intent.payoutAddress} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={intent.status} />
                  {intent.confirmationStage ? (
                    <StatusBadge status={intent.confirmationStage} />
                  ) : null}
                </div>
                <div>
                  <div className="text-muted-foreground">Expires</div>
                  {new Date(intent.expiresAt * 1000).toLocaleString()}
                </div>
                {blocked ? (
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    Not payable ({intent.status}).
                    <div className="mt-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/pay/${intent.intentId}/receipt`}>View receipt</Link>
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">Intent not found</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pay</CardTitle>
            <CardDescription>
              Success only after backend/onchain verification. Soft inclusion is not final.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!intent || blocked || !tokenOk ? (
              <p className="text-sm text-muted-foreground">Payment actions disabled.</p>
            ) : !isConnected || chainId !== config.chainId ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connect a wallet on Whitechain Sepolia to pay.
                </p>
                <WalletArea />
              </div>
            ) : phase === "review" || phase === "rejected" || phase === "failed" ? (
              <Tabs value={method} onValueChange={(v) => setMethod(v as "gasless" | "gasful")}>
                <TabsList className="w-full">
                  <TabsTrigger value="gasless" className="flex-1">
                    Gasless
                  </TabsTrigger>
                  <TabsTrigger value="gasful" className="flex-1">
                    Pay with gas
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="gasless" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You sign the exact USDT authorization. The relayer pays WBT gas. No silent
                    fallback to gasful.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => void loadQuote()}>
                    Load exact authorization
                  </Button>
                  {quote?.plainLanguage ? (
                    <div className="space-y-2 rounded-md border border-border p-3 text-xs">
                      <div className="font-medium">Authorization review</div>
                      <Row label="Summary" value={quote.plainLanguage.summary || ""} />
                      <Row label="Token" value={quote.plainLanguage.token || "Tether USD"} />
                      <Row label="Amount" value={`${intent.amountUsdt} USDT`} />
                      <Row label="From" value={address || ""} mono />
                      <Row label="Recipient contract" value={quote.paymentProcessor} mono />
                      <Row label="Then forwarded to" value={intent.payoutAddress} mono />
                      <Row
                        label="Valid before"
                        value={
                          quote.authorizationTemplate
                            ? new Date(
                                Number(quote.authorizationTemplate.validBefore) * 1000,
                              ).toLocaleString()
                            : "—"
                        }
                      />
                      <Row
                        label="Nonce"
                        value={quote.authorizationTemplate?.nonce || "—"}
                        mono
                      />
                      <Row label="Chain ID" value="1874" />
                    </div>
                  ) : null}
                  <Button
                    className="w-full"
                    disabled={!quote?.available || !quote.typedData}
                    onClick={() => void payGasless()}
                  >
                    Sign payment authorization
                  </Button>
                </TabsContent>
                <TabsContent value="gasful" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Your wallet sends approve (if needed) + pay. You need WBT for gas.
                  </p>
                  <Button className="w-full" variant="secondary" onClick={() => void payGasful()}>
                    Pay with wallet gas
                  </Button>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-4">
                <TransactionStatus
                  current={
                    phase === "wallet"
                      ? "Wallet prompt"
                      : phase === "pending"
                        ? "Pending"
                        : phase === "soft"
                          ? "Soft confirmed"
                          : "Failed"
                  }
                  note="Waiting for verified SETTLED status from API/chain."
                />
                {txHash ? (
                  <a
                    className="break-all font-mono text-xs text-primary underline"
                    href={explorerTx(txHash as `0x${string}`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {txHash}
                  </a>
                ) : null}
                {phase === "soft" ? (
                  <Button asChild className="w-full">
                    <Link href={`/pay/${intent.intentId}/receipt`}>Open receipt</Link>
                  </Button>
                ) : null}
              </div>
            )}
            {msg ? <p className="mt-4 text-sm text-destructive">{msg}</p> : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`max-w-[60%] break-all text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
