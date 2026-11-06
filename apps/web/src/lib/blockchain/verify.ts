import {
  type Address,
  type Hex,
  type TransactionReceipt,
  decodeEventLog,
  getAddress,
  parseAbiItem,
} from "viem";
import { paymentProcessorAbi } from "../abis";
import { config } from "../config";
import { ApiError } from "../errors";
import { getPublicClient, withRpcRetry } from "./client";
import { confirmationStage, getChainHeads, maybeReorged, type ConfirmationStage } from "./confirmations";
import { eventId } from "./event-id";

const paymentSettledEvent = parseAbiItem(
  "event PaymentSettled(uint256 indexed intentId, address indexed payer, address indexed merchant, uint256 amount, uint64 settledBlock)",
);
const paymentRefundedEvent = parseAbiItem(
  "event PaymentRefunded(uint256 indexed intentId, address indexed merchant, address indexed payer, uint256 amount)",
);
const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export type VerifiedPayment = {
  verified: true;
  intentId: string;
  payer: Address;
  merchant: Address;
  amount: string;
  settledBlock: string;
  txHash: Hex;
  confirmationStage: ConfirmationStage;
  eventId: string;
  transferMatched: boolean;
};

export type VerificationFailure = {
  verified: false;
  reason: string;
  confirmationStage: ConfirmationStage;
  reorged?: boolean;
};

export async function getReceipt(txHash: Hex): Promise<TransactionReceipt> {
  const client = getPublicClient();
  const receipt = await withRpcRetry("get_receipt", () =>
    client.getTransactionReceipt({ hash: txHash }),
  );
  if (!receipt) throw new ApiError("TX_NOT_FOUND", `Transaction ${txHash} not found`);
  return receipt;
}

/**
 * Verify a claimed payment against the onchain receipt and PaymentSettled event.
 * Never trusts the client body for completion.
 */
export async function verifyPaymentSettlement(params: {
  txHash: Hex;
  intentId: bigint;
  expectedMerchant: Address;
  expectedAmount: bigint;
  expectedPayout: Address;
}): Promise<VerifiedPayment | VerificationFailure> {
  const client = getPublicClient();
  const receipt = await getReceipt(params.txHash);
  const heads = await getChainHeads(client);

  if (receipt.status !== "success") {
    return { verified: false, reason: "transaction_reverted", confirmationStage: null };
  }

  const to = receipt.to ? getAddress(receipt.to) : null;
  if (!to || to !== getAddress(config.contracts.paymentProcessor)) {
    return {
      verified: false,
      reason: "unexpected_contract",
      confirmationStage: confirmationStage(receipt.blockNumber, heads),
    };
  }

  if (maybeReorged(receipt.blockNumber, heads)) {
    return {
      verified: false,
      reason: "block_ahead_of_tip",
      confirmationStage: "soft",
      reorged: true,
    };
  }

  // Confirm the receipt is still present at the settled block after a tip check.
  const stillThere = await withRpcRetry("recheck_receipt", () =>
    client.getTransactionReceipt({ hash: params.txHash }),
  );
  if (!stillThere || stillThere.blockHash !== receipt.blockHash) {
    return {
      verified: false,
      reason: "receipt_missing_after_reorg_check",
      confirmationStage: null,
      reorged: true,
    };
  }

  let settled:
    | {
        intentId: bigint;
        payer: Address;
        merchant: Address;
        amount: bigint;
        settledBlock: bigint;
        logIndex: number;
      }
    | undefined;

  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getAddress(config.contracts.paymentProcessor)) continue;
    try {
      const decoded = decodeEventLog({
        abi: [paymentSettledEvent],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "PaymentSettled") continue;
      const args = decoded.args as {
        intentId: bigint;
        payer: Address;
        merchant: Address;
        amount: bigint;
        settledBlock: bigint;
      };
      if (args.intentId !== params.intentId) continue;
      settled = {
        ...args,
        logIndex: log.logIndex!,
      };
      break;
    } catch {
      // not this event
    }
  }

  if (!settled) {
    return {
      verified: false,
      reason: "payment_settled_event_missing",
      confirmationStage: confirmationStage(receipt.blockNumber, heads),
    };
  }

  if (getAddress(settled.merchant) !== getAddress(params.expectedMerchant)) {
    return { verified: false, reason: "merchant_mismatch", confirmationStage: null };
  }
  if (settled.amount !== params.expectedAmount) {
    return { verified: false, reason: "amount_mismatch", confirmationStage: null };
  }

  let transferMatched = false;
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getAddress(config.usdt)) continue;
    try {
      const decoded = decodeEventLog({
        abi: [transferEvent],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") continue;
      const args = decoded.args as { from: Address; to: Address; value: bigint };
      if (
        getAddress(args.from) === getAddress(settled.payer) &&
        (getAddress(args.to) === getAddress(params.expectedPayout) ||
          getAddress(args.to) === getAddress(config.contracts.paymentProcessor)) &&
        args.value === params.expectedAmount
      ) {
        transferMatched = true;
        break;
      }
    } catch {
      // ignore
    }
  }

  return {
    verified: true,
    intentId: settled.intentId.toString(),
    payer: getAddress(settled.payer),
    merchant: getAddress(settled.merchant),
    amount: settled.amount.toString(),
    settledBlock: settled.settledBlock.toString(),
    txHash: params.txHash,
    confirmationStage: confirmationStage(receipt.blockNumber, heads),
    eventId: eventId({
      chainId: config.chainId,
      transactionHash: params.txHash,
      logIndex: settled.logIndex,
    }),
    transferMatched,
  };
}

export async function findRefundEvents(txHash: Hex, intentId: bigint) {
  const receipt = await getReceipt(txHash);
  const refunds: Array<{ merchant: Address; payer: Address; amount: string; logIndex: number }> =
    [];
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getAddress(config.contracts.paymentProcessor)) continue;
    try {
      const decoded = decodeEventLog({
        abi: [paymentRefundedEvent],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "PaymentRefunded") continue;
      const args = decoded.args as {
        intentId: bigint;
        merchant: Address;
        payer: Address;
        amount: bigint;
      };
      if (args.intentId !== intentId) continue;
      refunds.push({
        merchant: getAddress(args.merchant),
        payer: getAddress(args.payer),
        amount: args.amount.toString(),
        logIndex: log.logIndex!,
      });
    } catch {
      // ignore
    }
  }
  return refunds;
}

export { paymentProcessorAbi };
