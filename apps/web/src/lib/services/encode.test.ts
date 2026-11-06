import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { encodeCreateIntent, encodeRegister, stringToBytes32 } from "./encode";
import { config } from "../config";

describe("prepared tx encoding", () => {
  it("encodes register to BusinessRegistry", () => {
    const tx = encodeRegister({
      displayName: "Northwind",
      roles: 1,
      payoutAddress: getAddress("0xAE7168d00595a769C9434AB1ddE4D9F0273177CE"),
      webhookUrl: "",
    });
    expect(tx.to).toBe(config.contracts.businessRegistry);
    expect(tx.value).toBe("0");
    expect(tx.data.startsWith("0x")).toBe(true);
  });

  it("encodes createIntent to PaymentProcessor", () => {
    const tx = encodeCreateIntent({
      orderRef: "PO-1",
      amount: 1_000_000n,
      payer: getAddress("0x0000000000000000000000000000000000000000"),
      expiresAt: 2_000_000_000n,
    });
    expect(tx.to).toBe(config.contracts.paymentProcessor);
  });

  it("pads short order refs to bytes32", () => {
    expect(stringToBytes32("PO-1").length).toBe(66);
  });
});
