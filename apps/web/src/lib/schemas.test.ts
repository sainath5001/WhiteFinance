import { describe, expect, it } from "vitest";
import {
  addressSchema,
  amountBaseSchema,
  createIntentPreparedSchema,
  registerPreparedSchema,
  verifyPaymentSchema,
} from "./schemas";

describe("Zod schemas", () => {
  it("accepts checksummable addresses", () => {
    const a = addressSchema.parse("0xae7168d00595a769c9434ab1dde4d9f0273177ce");
    expect(a).toMatch(/^0xAE7168/);
  });

  it("rejects invalid addresses", () => {
    expect(() => addressSchema.parse("not-an-address")).toThrow();
  });

  it("requires positive amountBase integer strings", () => {
    expect(amountBaseSchema.parse("25000000")).toBe("25000000");
    expect(() => amountBaseSchema.parse("0")).toThrow();
    expect(() => amountBaseSchema.parse("1.5")).toThrow();
    expect(() => amountBaseSchema.parse("-1")).toThrow();
  });

  it("validates register prepared body", () => {
    const ok = registerPreparedSchema.parse({
      displayName: "Northwind",
      roles: 1,
      payoutAddress: "0xAE7168d00595a769C9434AB1ddE4D9F0273177CE",
      webhookUrl: "https://example.com/hook",
    });
    expect(ok.displayName).toBe("Northwind");
  });

  it("rejects empty displayName", () => {
    expect(() =>
      registerPreparedSchema.parse({ displayName: "", roles: 1 }),
    ).toThrow();
  });

  it("validates create intent prepared", () => {
    const ok = createIntentPreparedSchema.parse({
      merchant: "0xAE7168d00595a769C9434AB1ddE4D9F0273177CE",
      orderRef: "PO-1",
      amountBase: "1000000",
      expiresInSeconds: 1800,
    });
    expect(ok.expiresInSeconds).toBe(1800);
  });

  it("rejects bad verify payment body", () => {
    expect(() =>
      verifyPaymentSchema.parse({ txHash: "0x1234", intentId: "abc" }),
    ).toThrow();
  });
});
