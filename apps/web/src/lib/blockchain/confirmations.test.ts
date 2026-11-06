import { describe, expect, it } from "vitest";
import { confirmationStage, maybeReorged, type ChainHeads } from "./confirmations";

const heads: ChainHeads = {
  latest: 100n,
  safe: 90n,
  finalized: 80n,
};

describe("confirmation tracking", () => {
  it("returns null without a settled block", () => {
    expect(confirmationStage(null, heads)).toBeNull();
    expect(confirmationStage(0n, heads)).toBeNull();
  });

  it("classifies soft/safe/finalized", () => {
    expect(confirmationStage(95n, heads)).toBe("soft");
    expect(confirmationStage(85n, heads)).toBe("safe");
    expect(confirmationStage(70n, heads)).toBe("finalized");
  });

  it("detects reorg when settled block is ahead of tip", () => {
    expect(maybeReorged(101n, heads)).toBe(true);
    expect(maybeReorged(100n, heads)).toBe(false);
  });
});
