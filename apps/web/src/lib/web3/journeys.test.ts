/**
 * UNIT / JOURNEY CONTRACT TESTS
 * These assert frontend accounting and flow invariants.
 * They are NOT Whitechain Sepolia integration tests and do not broadcast transactions.
 *
 * Label legend used in this repo:
 * - unit: vitest, no network
 * - mock: fixture / stubbed
 * - testnet: requires funded wallets + live RPC (not executed in CI here)
 */
import { describe, expect, it } from "vitest";
import { buyerFinancingPreview, sellerFactoringPreview } from "./accounting";
import { assertPrizeUsdt, FORBIDDEN_USDT_E, contracts } from "./contracts";
import { config } from "@/lib/config";

describe("unit · journey accounting contracts", () => {
  it("seller factoring demo numbers (100k / 95k / 5k)", () => {
    const face = 100_000n * 1_000_000n;
    const advance = 95_000n * 1_000_000n;
    const discount = 5_000n * 1_000_000n;
    const p = sellerFactoringPreview(face, advance, discount);
    expect(p.invariantOk).toBe(true);
    expect(p.expectedGrossRepaymentToInvestor).toBe(face);
  });

  it("buyer financing demo numbers (100k / 30k / 1.5k fee)", () => {
    const face = 100_000n * 1_000_000n;
    const principal = 30_000n * 1_000_000n;
    const fee = 1_500n * 1_000_000n;
    const p = buyerFinancingPreview(face, principal, fee);
    expect(p.sellerRemainder).toBe(70_000n * 1_000_000n);
    expect(p.buyerObligationToInvestor).toBe(31_500n * 1_000_000n);
    expect(p.principalPaidToSeller + p.sellerRemainder).toBe(face);
  });

  it("refuses USDT.e and accepts prize USDT", () => {
    expect(assertPrizeUsdt(config.usdt)).toBe(true);
    expect(assertPrizeUsdt(FORBIDDEN_USDT_E)).toBe(false);
  });

  it("central contracts map covers protocol surface", () => {
    expect(contracts.paymentProcessor.address).toBe(config.contracts.paymentProcessor);
    expect(contracts.businessRegistry.address).toBe(config.contracts.businessRegistry);
    expect(contracts.invoiceRegistry.address).toBe(config.contracts.invoiceRegistry);
    expect(contracts.escrowVault.address).toBe(config.contracts.escrowVault);
    expect(contracts.sellerFinancing.address).toBe(config.contracts.sellerFinancing);
    expect(contracts.buyerFinancing.address).toBe(config.contracts.buyerFinancing);
    expect(config.chainId).toBe(1874);
  });
});

describe("testnet · manual checklist (not auto-run)", () => {
  it("documents required funded journeys without claiming execution", () => {
    const journeys = [
      "Merchant createIntent → customer gasful pay → merchant receipt",
      "Customer EIP-3009 gasless → relayer settle → SETTLED",
      "Full + partial refund",
      "Seller invoice → buyer confirm → seller factor → investor fund → buyer repay",
      "Buyer financing request → investor fund → repay + remainder",
    ];
    expect(journeys.length).toBe(5);
    // Intentionally no RPC calls — mark PASS only after manual Whitechain Sepolia runs.
  });
});
