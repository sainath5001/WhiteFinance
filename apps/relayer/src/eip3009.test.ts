import { describe, expect, it } from "vitest";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { getAddress } from "viem";
import { loadConfig } from "./config.js";
import {
  assertPackedEoaSignature,
  authorizationWindowStatus,
  buildTypedData,
  localDomainSeparator,
  recoverAuthorizationSigner,
} from "./eip3009.js";

const cfg = loadConfig({ requireKey: false });

describe("EIP-3009 typed data (local)", () => {
  it("computes domain separator matching known prize USDT value", () => {
    const local = localDomainSeparator(cfg);
    expect(local.toLowerCase()).toBe(cfg.expectedDomainSeparator.toLowerCase());
  });

  it("recovers a valid ReceiveWithAuthorization signature", async () => {
    const pk = generatePrivateKey();
    const account = privateKeyToAccount(pk);
    const message = {
      from: account.address,
      to: cfg.paymentProcessor,
      value: 25_000_000n,
      validAfter: 0n,
      validBefore: 2_000_000_000n,
      nonce: ("0x" + "11".repeat(32)) as `0x${string}`,
    };
    const typed = buildTypedData(cfg, message);
    const signature = await account.signTypedData(typed);
    expect(signature.length).toBe(132);
    assertPackedEoaSignature(signature);

    const recovered = await recoverAuthorizationSigner(cfg, { ...message, signature });
    expect(getAddress(recovered)).toBe(getAddress(account.address));
  });

  it("rejects wrong signer recovery for tampered amount", async () => {
    const pk = generatePrivateKey();
    const account = privateKeyToAccount(pk);
    const message = {
      from: account.address,
      to: cfg.paymentProcessor,
      value: 25_000_000n,
      validAfter: 0n,
      validBefore: 2_000_000_000n,
      nonce: ("0x" + "22".repeat(32)) as `0x${string}`,
    };
    const signature = await account.signTypedData(buildTypedData(cfg, message));
    const recovered = await recoverAuthorizationSigner(cfg, {
      ...message,
      value: 1n,
      signature,
    });
    expect(getAddress(recovered)).not.toBe(getAddress(account.address));
  });

  it("enforces exclusive validity window", () => {
    expect(authorizationWindowStatus(100, 100n, 200n)).toBe("early");
    expect(authorizationWindowStatus(101, 100n, 200n)).toBe("ok");
    expect(authorizationWindowStatus(200, 100n, 200n)).toBe("expired");
  });
});

describe("wrong chain / token domain (local)", () => {
  it("domain separator changes when chainId differs", () => {
    const wrong = localDomainSeparator({ ...cfg, chainId: 1 });
    expect(wrong.toLowerCase()).not.toBe(cfg.expectedDomainSeparator.toLowerCase());
  });

  it("domain separator changes when verifyingContract differs", () => {
    const wrong = localDomainSeparator({
      ...cfg,
      usdt: getAddress("0xaa7962d073935D387e8d442DA1D7149C81388f46"),
    });
    expect(wrong.toLowerCase()).not.toBe(cfg.expectedDomainSeparator.toLowerCase());
  });
});
