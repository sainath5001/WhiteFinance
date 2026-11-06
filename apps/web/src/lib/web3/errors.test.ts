import { describe, expect, it } from "vitest";
import { humanizeWeb3Error } from "./errors";

describe("humanizeWeb3Error", () => {
  it("maps user rejection", () => {
    expect(humanizeWeb3Error(new Error("User rejected the request"))).toMatch(/rejected/i);
  });

  it("maps insufficient USDT", () => {
    expect(humanizeWeb3Error(new Error("ERC20: transfer amount exceeds balance"))).toMatch(/USDT/i);
  });

  it("does not invent silent gasless fallback", () => {
    expect(humanizeWeb3Error(new Error("RELAYER_UNAVAILABLE"))).toMatch(/will not silently fall back/i);
  });
});
