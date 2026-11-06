import { describe, expect, it, vi, beforeEach } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getAddress } from "viem";
import { loadConfig } from "./config.js";
import { RelayerError } from "./errors.js";
import { buildTypedData } from "./eip3009.js";
import { setClientsForTests } from "./clients.js";
import { validateAuthorizationForIntent } from "./validate.js";

const cfg = loadConfig({ requireKey: false });

describe("validateAuthorizationForIntent (mocked chain)", () => {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  const merchant = getAddress("0xAE7168d00595a769C9434AB1ddE4D9F0273177CE");
  const payout = getAddress("0x2222222222222222222222222222222222222222");

  async function sign(value: bigint, overrides: Partial<{
    to: `0x${string}`;
    validAfter: bigint;
    validBefore: bigint;
    nonce: `0x${string}`;
  }> = {}) {
    const message = {
      from: account.address,
      to: overrides.to ?? cfg.paymentProcessor,
      value,
      validAfter: overrides.validAfter ?? 0n,
      validBefore: overrides.validBefore ?? BigInt(Math.floor(Date.now() / 1000) + 600),
      nonce: overrides.nonce ?? (("0x" + "33".repeat(32)) as `0x${string}`),
    };
    const signature = await account.signTypedData(buildTypedData(cfg, message));
    return { ...message, signature };
  }

  function mockClient(opts: {
    intentAmount?: bigint;
    intentStatus?: number;
    intentPayer?: `0x${string}`;
    expiresAt?: bigint;
    authUsed?: boolean;
    balance?: bigint;
    blocked?: boolean;
    merchantActive?: boolean;
  } = {}) {
    const intent = {
      merchant,
      payoutAddress: payout,
      orderRef: ("0x" + "44".repeat(32)) as `0x${string}`,
      amount: opts.intentAmount ?? 25_000_000n,
      payer: opts.intentPayer ?? ("0x0000000000000000000000000000000000000000" as const),
      expiresAt: opts.expiresAt ?? BigInt(Math.floor(Date.now() / 1000) + 3600),
      status: opts.intentStatus ?? 1,
      paidAmount: 0n,
      refundedAmount: 0n,
      payerSettled: "0x0000000000000000000000000000000000000000" as const,
      settledBlock: 0n,
    };
    return {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        switch (functionName) {
          case "getIntent":
            return intent;
          case "authorizationState":
            return opts.authUsed ?? false;
          case "isBlocked":
            return opts.blocked ?? false;
          case "balanceOf":
            return opts.balance ?? 100_000_000n;
          case "getBusiness":
            return {
              account: merchant,
              displayName: "M",
              roles: 1,
              payoutAddress: payout,
              active: opts.merchantActive ?? true,
              webhookUrl: "",
              createdAt: 0n,
              updatedAt: 0n,
            };
          default:
            throw new Error(`unexpected ${functionName}`);
        }
      }),
    };
  }

  beforeEach(() => setClientsForTests({ publicClient: null }));

  it("accepts a valid authorization", async () => {
    setClientsForTests({ publicClient: mockClient() as never });
    const auth = await sign(25_000_000n);
    const result = await validateAuthorizationForIntent({
      cfg: { ...cfg, paused: false },
      intentId: 1n,
      auth,
    });
    expect(result.recovered).toBe(account.address);
  });

  it("rejects invalid signature (wrong from)", async () => {
    setClientsForTests({ publicClient: mockClient() as never });
    const auth = await sign(25_000_000n);
    auth.from = getAddress("0x1111111111111111111111111111111111111111");
    await expect(
      validateAuthorizationForIntent({ cfg: { ...cfg, paused: false }, intentId: 1n, auth }),
    ).rejects.toMatchObject({ code: "AUTH_INVALID" });
  });

  it("rejects wrong recipient", async () => {
    setClientsForTests({ publicClient: mockClient() as never });
    const auth = await sign(25_000_000n, { to: payout });
    await expect(
      validateAuthorizationForIntent({ cfg: { ...cfg, paused: false }, intentId: 1n, auth }),
    ).rejects.toMatchObject({ code: "WRONG_RECIPIENT" });
  });

  it("rejects wrong amount", async () => {
    setClientsForTests({ publicClient: mockClient({ intentAmount: 25_000_000n }) as never });
    const auth = await sign(1n);
    await expect(
      validateAuthorizationForIntent({ cfg: { ...cfg, paused: false }, intentId: 1n, auth }),
    ).rejects.toMatchObject({ code: "WRONG_AMOUNT" });
  });

  it("rejects expired authorization", async () => {
    setClientsForTests({ publicClient: mockClient() as never });
    const now = Math.floor(Date.now() / 1000);
    const auth = await sign(25_000_000n, {
      validAfter: 0n,
      validBefore: BigInt(now - 10),
    });
    await expect(
      validateAuthorizationForIntent({
        cfg: { ...cfg, paused: false },
        intentId: 1n,
        auth,
        nowSec: now,
      }),
    ).rejects.toMatchObject({ code: "AUTH_EXPIRED" });
  });

  it("rejects reused nonce", async () => {
    setClientsForTests({ publicClient: mockClient({ authUsed: true }) as never });
    const auth = await sign(25_000_000n);
    await expect(
      validateAuthorizationForIntent({ cfg: { ...cfg, paused: false }, intentId: 1n, auth }),
    ).rejects.toMatchObject({ code: "AUTH_NONCE_USED" });
  });

  it("rejects already settled intent (replay)", async () => {
    setClientsForTests({ publicClient: mockClient({ intentStatus: 2 }) as never });
    const auth = await sign(25_000_000n);
    await expect(
      validateAuthorizationForIntent({ cfg: { ...cfg, paused: false }, intentId: 1n, auth }),
    ).rejects.toMatchObject({ code: "INTENT_NOT_CREATED" });
  });

  it("rejects bound payer mismatch", async () => {
    setClientsForTests({
      publicClient: mockClient({
        intentPayer: getAddress("0x1111111111111111111111111111111111111111"),
      }) as never,
    });
    const auth = await sign(25_000_000n);
    await expect(
      validateAuthorizationForIntent({ cfg: { ...cfg, paused: false }, intentId: 1n, auth }),
    ).rejects.toMatchObject({ code: "PAYER_MISMATCH" });
  });

  it("rejects excessive amount vs relayer cap", async () => {
    setClientsForTests({
      publicClient: mockClient({ intentAmount: 999_999_999_999n }) as never,
    });
    const auth = await sign(999_999_999_999n);
    await expect(
      validateAuthorizationForIntent({
        cfg: { ...cfg, paused: false, maxAmountBase: 1000n },
        intentId: 1n,
        auth,
      }),
    ).rejects.toMatchObject({ code: "AMOUNT_EXCEEDS_LIMIT" });
  });

  it("rejects insufficient USDT", async () => {
    setClientsForTests({ publicClient: mockClient({ balance: 1n }) as never });
    const auth = await sign(25_000_000n);
    await expect(
      validateAuthorizationForIntent({ cfg: { ...cfg, paused: false }, intentId: 1n, auth }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_USDT" });
  });

  it("rejects paused relayer", async () => {
    setClientsForTests({ publicClient: mockClient() as never });
    const auth = await sign(25_000_000n);
    await expect(
      validateAuthorizationForIntent({ cfg: { ...cfg, paused: true }, intentId: 1n, auth }),
    ).rejects.toBeInstanceOf(RelayerError);
  });

  it("rejects inactive merchant", async () => {
    setClientsForTests({ publicClient: mockClient({ merchantActive: false }) as never });
    const auth = await sign(25_000_000n);
    await expect(
      validateAuthorizationForIntent({ cfg: { ...cfg, paused: false }, intentId: 1n, auth }),
    ).rejects.toMatchObject({ code: "MERCHANT_INACTIVE" });
  });
});
