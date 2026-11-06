import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rate limit", () => {
  it("allows up to the limit then blocks", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3).ok).toBe(true);
    }
    const blocked = rateLimit(key, 3);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
