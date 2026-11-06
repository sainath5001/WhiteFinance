import { describe, expect, it, beforeEach } from "vitest";
import { enforceSubmitLimits, resetRateLimitsForTests, rateLimit } from "./limits.js";

describe("rate limits", () => {
  beforeEach(() => resetRateLimitsForTests());

  it("blocks after global limit", () => {
    expect(rateLimit("g", 2).ok).toBe(true);
    expect(rateLimit("g", 2).ok).toBe(true);
    expect(rateLimit("g", 2).ok).toBe(false);
  });

  it("enforces per-payer and per-ip", () => {
    const a = enforceSubmitLimits({
      ip: "1.1.1.1",
      payer: "0x1111111111111111111111111111111111111111",
      merchant: "0x2222222222222222222222222222222222222222",
      globalPerMin: 100,
      payerPerMin: 1,
      ipPerMin: 100,
      merchantPerMin: 100,
    });
    expect(a.ok).toBe(true);
    const b = enforceSubmitLimits({
      ip: "1.1.1.1",
      payer: "0x1111111111111111111111111111111111111111",
      merchant: "0x2222222222222222222222222222222222222222",
      globalPerMin: 100,
      payerPerMin: 1,
      ipPerMin: 100,
      merchantPerMin: 100,
    });
    expect(b.ok).toBe(false);
  });
});
