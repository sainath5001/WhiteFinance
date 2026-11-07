"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { SonarGrid } from "@/components/ui/sonar-grid";

export function LandingHero() {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <SonarGrid
      ringWidth={96}
      speed={240}
      amplitude={2}
      pingEvery={2.8}
      interactive
      spacing={28}
      baseOpacity={0.22}
      seedPing
      pingArea={[0.18, 0.16, 0.82, 0.78]}
      className="flex min-h-[100svh] w-full flex-col bg-background"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_42%_36%_at_50%_48%,hsl(var(--background)/0.92)_0%,transparent_72%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
        <div className="text-sm font-medium tracking-tight text-foreground/70">Whitechain Sepolia</div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/docs"
            className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
          </Link>
          <Link
            href="/app"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Open app
          </Link>
        </nav>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 pb-24 pt-10 text-center sm:px-8">
        <div className="flex max-w-3xl flex-col items-center">
          <motion.p
            {...enter(0)}
            className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            On Whitechain
          </motion.p>
          <motion.h1
            {...enter(0.08)}
            className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl"
          >
            WhiteFinance
          </motion.h1>
          <motion.p
            {...enter(0.16)}
            className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg"
          >
            Prize USDT checkout, invoice financing, and gasless authorization — settled onchain.
          </motion.p>
          <motion.div {...enter(0.24)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/app/merchant"
              className="group inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-[transform,box-shadow] duration-200 hover:shadow-md active:scale-[0.98]"
            >
              Start with merchant
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/demo/store"
              className="inline-flex h-11 items-center rounded-md border border-border bg-background/80 px-6 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-accent active:scale-[0.98]"
            >
              Demo store
            </Link>
          </motion.div>
        </div>
      </div>
    </SonarGrid>
  );
}
