import { describe, expect, it, beforeEach } from "vitest";
import {
  getBudgetState,
  recordSpend,
  remainingBudget,
  resetBudgetForTests,
} from "./budget.js";

describe("gas budget", () => {
  beforeEach(() => resetBudgetForTests());

  it("tracks daily spend", () => {
    const max = 1_000_000n;
    expect(remainingBudget(max)).toBe(max);
    recordSpend(100n, 2n); // 200
    expect(remainingBudget(max)).toBe(999_800n);
    expect(getBudgetState().txs).toBe(1);
  });

  it("exhausts budget", () => {
    recordSpend(10n, 100n);
    expect(remainingBudget(500n)).toBe(0n);
  });
});
