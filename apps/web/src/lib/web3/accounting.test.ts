import { describe, expect, it } from "vitest";
import { buyerFinancingPreview, sellerFactoringPreview } from "./accounting";

describe("accounting helpers", () => {
  it("seller factoring: advance + discount == face", () => {
    const p = sellerFactoringPreview(100_000n, 95_000n, 5_000n);
    expect(p.invariantOk).toBe(true);
    expect(p.expectedGrossRepaymentToInvestor).toBe(100_000n);
    expect(p.investorProfitIfRepaid).toBe(5_000n);
  });

  it("buyer financing: no double-count of principal", () => {
    const p = buyerFinancingPreview(100_000n, 30_000n, 1_500n);
    expect(p.invariantOk).toBe(true);
    expect(p.sellerRemainder).toBe(70_000n);
    expect(p.buyerObligationToInvestor).toBe(31_500n);
    expect(p.principalPaidToSeller + p.sellerRemainder).toBe(p.face);
  });
});
