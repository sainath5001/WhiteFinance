import Link from "next/link";
import { DemoBanner } from "@/components/shared/demo-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const items = [
  { id: "wrench", name: "Torque wrench set", price: 25 },
  { id: "bits", name: "Industrial bit kit", price: 48 },
  { id: "caliper", name: "Digital caliper", price: 90 },
];

export default function DemoStorePage() {
  return (
    <div className="min-h-screen">
      <DemoBanner />
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <div className="font-semibold">Northwind Demo Store</div>
            <div className="text-xs text-muted-foreground">
              Demo store · integrates WhiteFinance checkout
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/">WhiteFinance home</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-4 px-6 py-8 sm:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-base">{item.name}</CardTitle>
              <CardDescription>{item.price.toFixed(2)} USDT</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href={`/demo/store/checkout?sku=${item.id}&amount=${item.price}`}>
                  Checkout with WhiteFinance
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </main>
      <p className="mx-auto max-w-5xl px-6 pb-10 text-xs text-muted-foreground">
        This store never calls USDT transfer itself. It redirects to hosted checkout. SDK wiring is
        narrative-only in this stage.
      </p>
    </div>
  );
}
