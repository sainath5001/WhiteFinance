import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { setPublicClientForTests } from "./client";
import { verifyPaymentSettlement } from "./verify";
import { config } from "../config";

const merchant = getAddress("0xAE7168d00595a769C9434AB1ddE4D9F0273177CE");
const payer = getAddress("0x1111111111111111111111111111111111111111");
const payout = getAddress("0x2222222222222222222222222222222222222222");
const intentId = 7n;
const amount = 25_000_000n;
const txHash =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex;
const blockHash = ("0x" + "bb".repeat(32)) as Hex;

const paymentSettledAbi = [
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
] as const;

const transferAbi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { type: "address", name: "from", indexed: true },
      { type: "address", name: "to", indexed: true },
      { type: "uint256", name: "value", indexed: false },
    ],
  },
] as const;

function settledLog(logIndex: number) {
  const topics = encodeEventTopics({
    abi: paymentSettledAbi,
    eventName: "PaymentSettled",
    args: { intentId, payer, merchant },
  });
  const data = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint64" }],
    [amount, 50n],
  );
  return {
    address: config.contracts.paymentProcessor,
    topics,
    data,
    logIndex,
    transactionHash: txHash,
    blockNumber: 50n,
    blockHash,
    removed: false,
  };
}

function transferLog(to: `0x${string}`, logIndex: number) {
  const topics = encodeEventTopics({
    abi: transferAbi,
    eventName: "Transfer",
    args: { from: payer, to: getAddress(to) },
  });
  return {
    address: config.usdt,
    topics,
    data: encodeAbiParameters([{ type: "uint256" }], [amount]),
    logIndex,
    transactionHash: txHash,
    blockNumber: 50n,
    blockHash,
    removed: false,
  };
}

function mockClient(receipt: TransactionReceipt, latest: bigint) {
  return {
    getTransactionReceipt: vi.fn().mockResolvedValue(receipt),
    getBlockNumber: vi.fn().mockResolvedValue(latest),
    getBlock: vi.fn().mockRejectedValue(new Error("no tag")),
  };
}

describe("receipt verification", () => {
  beforeEach(() => {
    setPublicClientForTests(null);
  });

  it("verifies a successful PaymentSettled receipt", async () => {
    const receipt = {
      status: "success",
      to: config.contracts.paymentProcessor,
      blockNumber: 50n,
      blockHash,
      logs: [settledLog(0), transferLog(payout, 1)],
      transactionHash: txHash,
    } as unknown as TransactionReceipt;

    setPublicClientForTests(mockClient(receipt, 60n) as never);

    const result = await verifyPaymentSettlement({
      txHash,
      intentId,
      expectedMerchant: merchant,
      expectedAmount: amount,
      expectedPayout: payout,
    });
    expect(result.verified).toBe(true);
    if (result.verified) {
      expect(result.amount).toBe(amount.toString());
      expect(result.transferMatched).toBe(true);
      expect(result.eventId).toContain(":0");
    }
  });

  it("rejects unexpected contract", async () => {
    const receipt = {
      status: "success",
      to: payout,
      blockNumber: 50n,
      blockHash,
      logs: [],
      transactionHash: txHash,
    } as unknown as TransactionReceipt;
    setPublicClientForTests(mockClient(receipt, 60n) as never);

    const result = await verifyPaymentSettlement({
      txHash,
      intentId,
      expectedMerchant: merchant,
      expectedAmount: amount,
      expectedPayout: payout,
    });
    expect(result.verified).toBe(false);
    if (!result.verified) expect(result.reason).toBe("unexpected_contract");
  });

  it("flags reorg when block is ahead of tip", async () => {
    const receipt = {
      status: "success",
      to: config.contracts.paymentProcessor,
      blockNumber: 99n,
      blockHash,
      logs: [settledLog(0)],
      transactionHash: txHash,
    } as unknown as TransactionReceipt;
    setPublicClientForTests(mockClient(receipt, 50n) as never);

    const result = await verifyPaymentSettlement({
      txHash,
      intentId,
      expectedMerchant: merchant,
      expectedAmount: amount,
      expectedPayout: payout,
    });
    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.reorged).toBe(true);
      expect(result.reason).toBe("block_ahead_of_tip");
    }
  });

  it("rejects missing PaymentSettled event", async () => {
    const receipt = {
      status: "success",
      to: config.contracts.paymentProcessor,
      blockNumber: 50n,
      blockHash,
      logs: [],
      transactionHash: txHash,
    } as unknown as TransactionReceipt;
    setPublicClientForTests(mockClient(receipt, 60n) as never);

    const result = await verifyPaymentSettlement({
      txHash,
      intentId,
      expectedMerchant: merchant,
      expectedAmount: amount,
      expectedPayout: payout,
    });
    expect(result.verified).toBe(false);
    if (!result.verified) expect(result.reason).toBe("payment_settled_event_missing");
  });
});
