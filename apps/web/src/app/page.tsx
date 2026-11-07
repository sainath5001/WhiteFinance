import Link from "next/link";
import { LandingHero } from "@/components/marketing/landing-hero";

export default function MarketingPage() {
  return (
    <div className="min-h-screen">
      <LandingHero />

      <section className="border-t border-border bg-background px-6 py-20 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-3 md:gap-10">
          {[
            {
              title: "Operate",
              body: "Payment intents, hosted checkout, refunds, and merchant receipts in prize USDT.",
              href: "/app/merchant",
            },
            {
              title: "Tokenize",
              body: "Invoice registry with seller factoring or buyer financing — never double-counted.",
              href: "/app/seller",
            },
            {
              title: "Scale",
              body: "EIP-3009 gasless authorization. Customer signs exact USDT; relayer pays WBT gas.",
              href: "/pay/1",
            },
          ].map((item) => (
            <div key={item.title} className="max-w-sm">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              <Link
                href={item.href}
                className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Explore
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground sm:px-8">
        WhiteFinance on Whitechain Sepolia · chain is source of truth · prize USDT only
      </footer>
    </div>
  );
}
