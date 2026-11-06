import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../errors";
import { withRpcRetry } from "./client";

describe("RPC retry/backoff", () => {
  it("retries then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("temp"))
      .mockRejectedValueOnce(new Error("temp"))
      .mockResolvedValueOnce("ok");
    await expect(withRpcRetry("test", fn, 4)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws CHAIN_UNAVAILABLE after exhaustion", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("down"));
    await expect(withRpcRetry("test", fn, 2)).rejects.toBeInstanceOf(ApiError);
    await expect(withRpcRetry("test", fn, 2)).rejects.toMatchObject({
      code: "CHAIN_UNAVAILABLE",
    });
  });
});
