import type { Address, Hex } from "viem";
import { paymentProcessorAbi } from "../abis";
import { getPublicClient, withRpcRetry } from "../blockchain/client";
import {
  confirmationStage,
  getChainHeads,
  maybeReorged,
} from "../blockchain/confirmations";
import { scanContractEvents } from "../blockchain/scanner";
import { findRefundEvents, verifyPaymentSettlement } from "../blockchain/verify";
import { config } from "../config";
import { ApiError } from "../errors";
import {
  amountUsdt,
  bytes32ToOrderRef,
  checkoutUrl,
  intentStatusName,
  nullAddress,
  txMeta,
} from "../format";
import { getBusinessOrNull } from "./business";
import { encodeCreateIntent, encodeRefund, zeroAddress } from "./encode";

async function readIntent(intentId: bigint) {
  const client = getPublicClient();
  try {
    const intent = await withRpcRetry("getIntent", () =>
      client.readContract({
        address: config.contracts.paymentProcessor,
        abi: paymentProcessorAbi,
        functionName: "getIntent",
        args: [intentId],
      }),
    );
    return intent as {
      merchant: Address;
      payoutAddress: Address;
      orderRef: Hex;
      amount: bigint;
      payer: Address;
      expiresAt: bigint;
      status: number;
      paidAmount: bigint;
      refundedAmount: bigint;
      payerSettled: Address;
      settledBlock: bigint;
    };
  } catch {
    throw new ApiError("INTENT_NOT_FOUND", `Payment intent ${intentId} does not exist`);
  }
}

export async function getPaymentIntent(intentId: string) {
  const id = BigInt(intentId);
  const intent = await readIntent(id);
  const business = await getBusinessOrNull(intent.merchant);
  const client = getPublicClient();
  const heads = await getChainHeads(client);
  const settledBlock = intent.settledBlock === 0n ? null : intent.settledBlock;

  let stage = confirmationStage(settledBlock, heads);
  let reorged = false;
  if (settledBlock && maybeReorged(settledBlock, heads)) {
    reorged = true;
    stage = null;
  }

  // Find settlement tx from events (bounded scan). Not a DB.
  const settledEvents = await scanContractEvents({
    address: config.contracts.paymentProcessor,
    abi: paymentProcessorAbi,
    eventName: "PaymentSettled",
    args: { intentId: id },
    maxLogs: 5,
  });
  const settled = settledEvents[0];

  return {
    intentId: id.toString(),
    merchant: intent.merchant,
    payoutAddress: intent.payoutAddress,
    merchantName: business?.displayName ?? null,
    orderRef: bytes32ToOrderRef(intent.orderRef),
    orderRefRaw: intent.orderRef,
    amountBase: intent.amount.toString(),
    amountUsdt: amountUsdt(intent.amount),
    token: config.usdt,
    payer: nullAddress(intent.payer),
    payerSettled: nullAddress(intent.payerSettled),
    expiresAt: Number(intent.expiresAt),
    status: intentStatusName(intent.status).toUpperCase(),
    statusRaw: intent.status,
    paidAmountBase: intent.paidAmount.toString(),
    refundedAmountBase: intent.refundedAmount.toString(),
    settledBlock: settledBlock?.toString() ?? null,
    confirmationStage: stage,
    reorged,
    ...txMeta(settled?.transactionHash),
    checkoutUrl: checkoutUrl(id.toString()),
  };
}

export async function listPaymentIntents(merchant: Address, limit = 20) {
  const created = await scanContractEvents({
    address: config.contracts.paymentProcessor,
    abi: paymentProcessorAbi,
    eventName: "PaymentIntentCreated",
    args: { merchant },
    maxLogs: limit,
  });

  const items = [];
  for (const ev of created.slice(0, limit)) {
    const intentId = (ev.args.intentId as bigint).toString();
    try {
      items.push(await getPaymentIntent(intentId));
    } catch {
      // skip deleted / unreadable
    }
  }
  return {
    merchant,
    count: items.length,
    items,
    note: "Bounded event scan from deployment block. Not a full historical warehouse.",
  };
}

export async function getPaymentReceipt(intentId: string) {
  const intent = await getPaymentIntent(intentId);
  const id = BigInt(intentId);
  const settledEvents = await scanContractEvents({
    address: config.contracts.paymentProcessor,
    abi: paymentProcessorAbi,
    eventName: "PaymentSettled",
    args: { intentId: id },
    maxLogs: 5,
  });
  const refundEvents = await scanContractEvents({
    address: config.contracts.paymentProcessor,
    abi: paymentProcessorAbi,
    eventName: "PaymentRefunded",
    args: { intentId: id },
    maxLogs: 20,
  });

  let verification = null;
  if (intent.txHash && intent.paidAmountBase !== "0") {
    verification = await verifyPaymentSettlement({
      txHash: intent.txHash as Hex,
      intentId: id,
      expectedMerchant: intent.merchant as Address,
      expectedAmount: BigInt(intent.amountBase),
      expectedPayout: intent.payoutAddress as Address,
    });
  }

  return {
    ...intent,
    events: {
      settled: settledEvents.map((e) => ({
        id: e.id,
        txHash: e.transactionHash,
        blockNumber: e.blockNumber.toString(),
        args: {
          payer: e.args.payer,
          merchant: e.args.merchant,
          amount: (e.args.amount as bigint).toString(),
          settledBlock: (e.args.settledBlock as bigint).toString(),
        },
      })),
      refunded: refundEvents.map((e) => ({
        id: e.id,
        txHash: e.transactionHash,
        blockNumber: e.blockNumber.toString(),
        args: {
          merchant: e.args.merchant,
          payer: e.args.payer,
          amount: (e.args.amount as bigint).toString(),
        },
      })),
    },
    verification,
  };
}

export function prepareCreateIntent(input: {
  merchant: Address;
  orderRef: string;
  amountBase: string;
  payer?: Address | null;
  expiresInSeconds: number;
}) {
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + input.expiresInSeconds);
  return {
    ...encodeCreateIntent({
      orderRef: input.orderRef,
      amount: BigInt(input.amountBase),
      payer: input.payer || zeroAddress(),
      expiresAt,
    }),
    merchant: input.merchant,
    expiresAt: Number(expiresAt),
    note: "Client must broadcast createIntent and parse PaymentIntentCreated for intentId. API cannot allocate IDs offchain.",
  };
}

export function prepareRefund(intentId: string, amountBase: string) {
  return {
    ...encodeRefund(BigInt(intentId), BigInt(amountBase)),
    note: "Merchant wallet must hold USDT and broadcast refund. Server never holds merchant keys.",
  };
}

export async function verifyClaimedPayment(txHash: Hex, intentId: string) {
  const intent = await getPaymentIntent(intentId);
  const result = await verifyPaymentSettlement({
    txHash,
    intentId: BigInt(intentId),
    expectedMerchant: intent.merchant as Address,
    expectedAmount: BigInt(intent.amountBase),
    expectedPayout: intent.payoutAddress as Address,
  });
  if (!result.verified) {
    if (result.reorged) {
      throw new ApiError("REORGED", "Settlement receipt is not stable on the current chain tip", {
        reason: result.reason,
      });
    }
    throw new ApiError("PAYMENT_UNVERIFIED", "Payment could not be verified onchain", {
      reason: result.reason,
    });
  }
  return result;
}

export async function refundsForTx(txHash: Hex, intentId: string) {
  return findRefundEvents(txHash, BigInt(intentId));
}
