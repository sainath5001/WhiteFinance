import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { loadConfig } from "./config.js";
import { setClientsForTests } from "./clients.js";
import { buildTypedData } from "./eip3009.js";
import { resetIdemForTests } from "./idempotency.js";
import { resetRateLimitsForTests } from "./limits.js";
import { resetBudgetForTests } from "./budget.js";
import { submitSettlement } from "./submit.js";

const cfg = {
  ...loadConfig({ requireKey: false }),
  paused: false,
  privateKey: generatePrivateKey(),
  maxGasPerTx: 1_000_000n,
  maxWbtPerDayWei: 10n ** 18n,
  minWbtWei: 1n,
};

const account = privateKeyToAccount(cfg.privateKey!);
const merchant = getAddress("0xAE7168d00595a769C9434AB1ddE4D9F0273177CE");
const payout = getAddress("0x2222222222222222222222222222222222222222");
const txHash = ("0x" + "ab".repeat(32)) as Hex;
const blockHash = ("0x" + "cd".repeat(32)) as Hex;

describe("submitSettlement verification (mocked)", () => {
  beforeEach(() => {
    resetIdemForTests();
    resetRateLimitsForTests();
    resetBudgetForTests();
    setClientsForTests({ publicClient: null, walletClient: null, account: null });
  });

  async function makeAuth(value = 25_000_000n) {
    const payer = privateKeyToAccount(generatePrivateKey());
    const message = {
      from: payer.address,
      to: cfg.paymentProcessor,
      value,
      validAfter: 0n,
      validBefore: BigInt(Math.floor(Date.now() / 1000) + 600),
      nonce: ("0x" + "55".repeat(32)) as Hex,
    };
    const signature = await payer.signTypedData(buildTypedData(cfg, message));
    return { auth: { ...message, signature }, payer };
  }

  function settledLog(intentId: bigint, payer: `0x${string}`, amount: bigint) {
    const topics = encodeEventTopics({
      abi: [
        {
          type: "event",
          name: "PaymentSettled",
          inputs: [
            { type: "uint256", name: "intentId", indexed: true },
            { type: "address", name: "payer", indexed: true },
            { type: "address", name: "merchant", indexed: true },
            { type: "uint256", name: "amount", indexed: false },
            { type: "uint64", name: "settledBlock", indexed: false },
          ],
        },
      ],
      eventName: "PaymentSettled",
      args: { intentId, payer, merchant },
    });
    return {
      address: cfg.paymentProcessor,
      topics,
      data: encodeAbiParameters(
        [{ type: "uint256" }, { type: "uint64" }],
        [amount, 10n],
      ),
      logIndex: 0,
      transactionHash: txHash,
      blockNumber: 10n,
      blockHash,
      removed: false,
    };
  }

  it("marks complete only after PaymentSettled + settled intent", async () => {
    const { auth, payer } = await makeAuth();
    const amount = 25_000_000n;

    const publicClient = {
      getChainId: vi.fn().mockResolvedValue(1874),
      getBalance: vi.fn().mockResolvedValue(10n ** 18n),
      getTransactionCount: vi.fn().mockResolvedValue(0),
      estimateGas: vi.fn().mockResolvedValue(200_000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        status: "success",
        gasUsed: 150_000n,
        effectiveGasPrice: 1n,
        logs: [settledLog(1n, payer.address, amount)],
        blockNumber: 10n,
        blockHash,
        transactionHash: txHash,
        to: cfg.paymentProcessor,
      } satisfies Partial<TransactionReceipt>),
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        switch (functionName) {
          case "name":
            return "Tether USD";
          case "decimals":
            return 6;
          case "DOMAIN_SEPARATOR":
            return cfg.expectedDomainSeparator;
          case "usdt":
            return cfg.usdt;
          case "getIntent":
            return {
              merchant,
              payoutAddress: payout,
              orderRef: ("0x" + "66".repeat(32)) as Hex,
              amount,
              payer: "0x0000000000000000000000000000000000000000",
              expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
              status: 1,
              paidAmount: 0n,
              refundedAmount: 0n,
              payerSettled: "0x0000000000000000000000000000000000000000",
              settledBlock: 0n,
            };
          case "authorizationState":
            return false;
          case "isBlocked":
            return false;
          case "balanceOf":
            return amount;
          case "getBusiness":
            return {
              account: merchant,
              displayName: "M",
              roles: 1,
              payoutAddress: payout,
              active: true,
              webhookUrl: "",
              createdAt: 0n,
              updatedAt: 0n,
            };
          default:
            throw new Error(functionName);
        }
      }),
    };

    // After submit, final getIntent should show Settled
    let getIntentCalls = 0;
    const originalRead = publicClient.readContract;
    publicClient.readContract = vi.fn(async (args: { functionName: string }) => {
      if (args.functionName === "getIntent") {
        getIntentCalls += 1;
        if (getIntentCalls > 1) {
          return {
            merchant,
            payoutAddress: payout,
            orderRef: ("0x" + "66".repeat(32)) as Hex,
            amount,
            payer: "0x0000000000000000000000000000000000000000",
            expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
            status: 2,
            paidAmount: amount,
            refundedAmount: 0n,
            payerSettled: payer.address,
            settledBlock: 10n,
          };
        }
      }
      return originalRead(args);
    });

    const walletClient = {
      chain: { id: 1874 },
      sendTransaction: vi.fn().mockResolvedValue(txHash),
    };

    setClientsForTests({
      publicClient: publicClient as never,
      walletClient: walletClient as never,
      account: account as never,
    });

    const result = await submitSettlement({
      cfg,
      intentId: "1",
      auth,
      ip: "127.0.0.1",
      idempotencyKey: "test-1",
    });
    expect(result.status).toBe("SUCCESS");
    expect(result.txHash).toBe(txHash);

    const dup = await submitSettlement({
      cfg,
      intentId: "1",
      auth,
      ip: "127.0.0.1",
      idempotencyKey: "test-1",
    });
    expect(dup.duplicate).toBe(true);
    expect(walletClient.sendTransaction).toHaveBeenCalledTimes(1);
  });

  it("fails when receipt reverts", async () => {
    const { auth, payer } = await makeAuth();
    const amount = 25_000_000n;
    const publicClient = {
      getChainId: vi.fn().mockResolvedValue(1874),
      getBalance: vi.fn().mockResolvedValue(10n ** 18n),
      getTransactionCount: vi.fn().mockResolvedValue(0),
      estimateGas: vi.fn().mockResolvedValue(200_000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        status: "reverted",
        gasUsed: 100n,
        effectiveGasPrice: 1n,
        logs: [],
        transactionHash: txHash,
      }),
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        switch (functionName) {
          case "name":
            return "Tether USD";
          case "decimals":
            return 6;
          case "DOMAIN_SEPARATOR":
            return cfg.expectedDomainSeparator;
          case "usdt":
            return cfg.usdt;
          case "getIntent":
            return {
              merchant,
              payoutAddress: payout,
              orderRef: ("0x" + "66".repeat(32)) as Hex,
              amount,
              payer: "0x0000000000000000000000000000000000000000",
              expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
              status: 1,
              paidAmount: 0n,
              refundedAmount: 0n,
              payerSettled: "0x0000000000000000000000000000000000000000",
              settledBlock: 0n,
            };
          case "authorizationState":
            return false;
          case "isBlocked":
            return false;
          case "balanceOf":
            return amount;
          case "getBusiness":
            return {
              account: merchant,
              displayName: "M",
              roles: 1,
              payoutAddress: payout,
              active: true,
              webhookUrl: "",
              createdAt: 0n,
              updatedAt: 0n,
            };
          default:
            throw new Error(functionName);
        }
      }),
    };
    setClientsForTests({
      publicClient: publicClient as never,
      walletClient: {
        chain: { id: 1874 },
        sendTransaction: vi.fn().mockResolvedValue(txHash),
      } as never,
      account: account as never,
    });

    await expect(
      submitSettlement({
        cfg,
        intentId: "1",
        auth,
        ip: "127.0.0.1",
        idempotencyKey: "fail-1",
      }),
    ).rejects.toMatchObject({ code: "TX_FAILED" });
    void payer;
  });

  it("rejects when relayer WBT is insufficient", async () => {
    const { auth } = await makeAuth();
    const publicClient = {
      getChainId: vi.fn().mockResolvedValue(1874),
      getBalance: vi.fn().mockResolvedValue(0n),
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        switch (functionName) {
          case "name":
            return "Tether USD";
          case "decimals":
            return 6;
          case "DOMAIN_SEPARATOR":
            return cfg.expectedDomainSeparator;
          case "usdt":
            return cfg.usdt;
          case "getIntent":
            return {
              merchant,
              payoutAddress: payout,
              orderRef: ("0x" + "66".repeat(32)) as Hex,
              amount: 25_000_000n,
              payer: "0x0000000000000000000000000000000000000000",
              expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
              status: 1,
              paidAmount: 0n,
              refundedAmount: 0n,
              payerSettled: "0x0000000000000000000000000000000000000000",
              settledBlock: 0n,
            };
          case "authorizationState":
            return false;
          case "isBlocked":
            return false;
          case "balanceOf":
            return 25_000_000n;
          case "getBusiness":
            return {
              account: merchant,
              displayName: "M",
              roles: 1,
              payoutAddress: payout,
              active: true,
              webhookUrl: "",
              createdAt: 0n,
              updatedAt: 0n,
            };
          default:
            throw new Error(functionName);
        }
      }),
    };
    setClientsForTests({
      publicClient: publicClient as never,
      walletClient: { chain: { id: 1874 }, sendTransaction: vi.fn() } as never,
      account: account as never,
    });

    await expect(
      submitSettlement({
        cfg: { ...cfg, minWbtWei: 1n },
        intentId: "1",
        auth,
        ip: "127.0.0.1",
        idempotencyKey: "nowbt",
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_RELAYER_WBT" });
  });
});
