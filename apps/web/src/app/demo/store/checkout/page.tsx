"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DemoBanner } from "@/components/shared/demo-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function CheckoutInner() {
  const params = useSearchParams();
  const sku = params.get("sku") ?? "wrench";
  const amount = params.get("amount") ?? "25";

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Demo store checkout</CardTitle>
        <CardDescription>
          Would create a payment intent then redirect to /pay/{"{intentId}"}. Using fixture intent
          #13 for layout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">SKU</span>
          <span>{sku}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount</span>
          <span className="tabular">{Number(amount).toFixed(2)} USDT</span>
        </div>
        <Button asChild className="w-full">
          <Link href="/pay/13">Continue to WhiteFinance checkout</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/demo/store">Back to store</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DemoStoreCheckoutPage() {
  return (
    <div className="min-h-screen">
      <DemoBanner />
      <main className="px-4 py-10">
        <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading…</div>}>
          <CheckoutInner />
        </Suspense>
      </main>
    </div>
  );
}
