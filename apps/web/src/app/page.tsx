import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoBanner } from "@/components/shared/demo-banner";

export default function MarketingPage() {
  return (
    <div className="min-h-screen">
      <DemoBanner />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div>
          <div className="text-xl font-semibold tracking-tight">WhiteFinance</div>
          <div className="text-xs text-muted-foreground">Whitechain Sepolia · prize USDT</div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/docs">Docs</Link>
          </Button>
          <Button asChild>
            <Link href="/app">
              Open app <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        <section className="max-w-3xl animate-fade-in">
          <p className="mb-3 text-sm font-medium text-primary">Business finance on Whitechain</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            WhiteFinance
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Stablecoin checkout, invoice financing, and gasless USDT payments. Merchants settle in
            prize USDT. Investors fund receivables. Customers can authorize exact payments without
            holding WBT.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/app/merchant">Merchant dashboard</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pay/13">Preview checkout</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/demo/store">Demo store</Link>
            </Button>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Operate",
              body: "Payment intents, hosted checkout, refunds, and merchant receipts.",
            },
            {
              title: "Tokenize",
              body: "Invoice registry with mutually exclusive seller factoring or buyer financing.",
            },
            {
              title: "Scale",
              body: "EIP-3009 receiveWithAuthorization. Customer signs exact USDT; relayer pays gas.",
            },
          ].map((card) => (
            <div key={card.title} className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-base font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{card.body}</p>
            </div>
          ))}
        </section>

        <p className="mt-12 text-xs text-muted-foreground">
          This frontend stage uses labelled demo fixtures. It does not claim live wallet, contract,
          API, or relayer integration.
        </p>
      </main>
    </div>
  );
}
