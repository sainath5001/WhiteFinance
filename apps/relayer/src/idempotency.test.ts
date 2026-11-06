import { describe, expect, it, beforeEach } from "vitest";
import { authFingerprint, getIdem, putIdem, resetIdemForTests } from "./idempotency.js";

describe("idempotency", () => {
  beforeEach(() => resetIdemForTests());

  it("stores and returns records", () => {
    putIdem(
      {
        key: "k1",
        intentId: "1",
        txHash: "0xabc",
        status: "SUCCESS",
        createdAt: Date.now(),
      },
      60_000,
    );
    expect(getIdem("k1")?.txHash).toBe("0xabc");
  });

  it("fingerprints auth by intent+from+nonce", () => {
    const a = authFingerprint("1", "0xAA", "0xBb");
    const b = authFingerprint("1", "0xaa", "0xbb");
    expect(a).toBe(b);
  });
});
