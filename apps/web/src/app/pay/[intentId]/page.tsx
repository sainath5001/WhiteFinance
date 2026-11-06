"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { DemoBanner } from "@/components/shared/demo-banner";
import { AddressText } from "@/components/shared/address";
import { StatusBadge } from "@/components/shared/status-badge";
import { TransactionStatus } from "@/components/shared/tx-status";
import { WalletArea } from "@/components/shared/wallet-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  demoMerchant,
  getDemoIntent,
  PAYMENT_PROCESSOR,
  PRIZE_USDT,
  demoRelayer,
} from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

type UiPhase = "review" | "pending" | "success" | "failure";

export default function CheckoutPage() {
  const params = useParams<{ intentId: string }>();
  const intent = getDemoIntent(params.intentId) ?? getDemoIntent("13");
  const [phase, setPhase] = useState<UiPhase>("review");
  const [method, setMethod] = useState<"gasless" | "gasful">("gasless");

  const blocked =
    intent?.status === "EXPIRED" ||
    intent?.status === "CANCELLED" ||
    intent?.status === "SETTLED" ||
    intent?.status === "REFUNDED" ||
    intent?.status === "PARTIALLY_REFUNDED";

  const authPreview = useMemo(
    () => ({
      token: "Tether USD (USDT)",
      amount: intent ? formatUsdt(intent.amountUsdt) : "—",
      from: "0xCustomer… (connect wallet — not live)",
      recipient: PAYMENT_PROCESSOR,
      payout: demoMerchant.payoutAddress,
      validAfter: "immediately (validAfter = 0)",
      validBefore: intent ? new Date(intent.expiresAt).toLocaleString() : "—",
      nonce: "0xdemo…nonce (fixture)",
      chainId: 1874,
    }),
    [intent],
  );

  if (!intent) {
    return (
      <div className="min-h-screen">
        <DemoBanner />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Payment not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">No demo fixture for this intent.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <DemoBanner />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div>
          <div className="font-semibold">WhiteFinance Checkout</div>
          <div className="text-xs text-muted-foreground">Hosted payment · demo fixture</div>
        </div>
        <WalletArea />
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 pb-16 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{demoMerchant.name}</CardTitle>
            <CardDescription>Order {intent.orderRef}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="text-muted-foreground">Amount</div>
              <div className="tabular text-3xl font-semibold">{formatUsdt(intent.amountUsdt)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Token</div>
              <div>USDT · prize address</div>
              <AddressText address={PRIZE_USDT} />
            </div>
            <div>
              <div className="text-muted-foreground">Payout</div>
              <AddressText address={demoMerchant.payoutAddress} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={intent.status} />
            </div>
            <div>
              <div className="text-muted-foreground">Expires</div>
              {new Date(intent.expiresAt).toLocaleString()}
            </div>
            {blocked ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                This payment is not payable ({intent.status.replaceAll("_", " ")}).
                <div className="mt-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/pay/${intent.id}/receipt`}>View receipt</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pay</CardTitle>
            <CardDescription>
              Never marks success from local UI alone. Demo actions simulate flow states only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {blocked ? (
              <p className="text-sm text-muted-foreground">Payment actions disabled for this status.</p>
            ) : phase === "review" ? (
              <Tabs
                value={method}
                onValueChange={(v) => setMethod(v as "gasless" | "gasful")}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="gasless" className="flex-1" disabled={demoRelayer.paused}>
                    Gasless
                  </TabsTrigger>
                  <TabsTrigger value="gasful" className="flex-1">
                    Pay with gas
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="gasless" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You sign the exact USDT transfer. WhiteFinance pays WBT gas.
                  </p>
                  <div className="space-y-2 rounded-md border border-border p-3 text-xs">
                    <div className="font-medium">Authorization review</div>
                    <Row label="Token" value={authPreview.token} />
                    <Row label="Amount" value={authPreview.amount} />
                    <Row label="From" value={authPreview.from} />
                    <Row label="Recipient contract" value={authPreview.recipient} mono />
                    <Row label="Then forwarded to" value={authPreview.payout} mono />
                    <Row label="Valid after" value={authPreview.validAfter} />
                    <Row label="Valid before" value={authPreview.validBefore} />
                    <Row label="Nonce" value={authPreview.nonce} mono />
                    <Row label="Chain ID" value={String(authPreview.chainId)} />
                  </div>
                  <Button className="w-full" onClick={() => setPhase("pending")}>
                    Sign payment authorization
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Label is intentional: unsigned payment is impossible.
                  </p>
                </TabsContent>
                <TabsContent value="gasful" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Your wallet sends the transaction. You need WBT for gas.
                  </p>
                  <Button className="w-full" variant="secondary" onClick={() => setPhase("pending")}>
                    Continue to wallet prompt (demo)
                  </Button>
                </TabsContent>
              </Tabs>
            ) : phase === "pending" ? (
              <div className="space-y-4">
                <TransactionStatus current="Pending" note="Waiting for confirmation. Demo only." />
                <div className="flex gap-2">
                  <Button onClick={() => setPhase("success")}>Simulate soft confirm</Button>
                  <Button variant="outline" onClick={() => setPhase("failure")}>
                    Simulate failure
                  </Button>
                </div>
              </div>
            ) : phase === "success" ? (
              <div className="space-y-4">
                <TransactionStatus
                  current="Soft confirmed"
                  note="Soft inclusion is not final. Re-read intent from chain/API before fulfilling goods."
                />
                <Button asChild className="w-full">
                  <Link href={`/pay/${intent.id}/receipt`}>Open receipt</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <TransactionStatus current="Failed" />
                <Button variant="outline" onClick={() => setPhase("review")}>
                  Try again
                </Button>
              </div>
            )}
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
      <span className={`text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
