import {
  type Hex,
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  isAddressEqual,
  parseAbiItem,
} from "viem";
import { paymentProcessorAbi } from "./abis.js";
import { getRelayerAccount, getPublicClient, getWalletClient, withRpcRetry } from "./clients.js";
import type { RelayerConfig } from "./config.js";
import { RelayerError } from "./errors.js";
import { type ReceiveAuthorization } from "./eip3009.js";
import { authFingerprint, getIdem, putIdem } from "./idempotency.js";
import { enforceSubmitLimits } from "./limits.js";
import { logger } from "./logger.js";
import { recordSpend, setTxStatus } from "./budget.js";
import {
  assertRelayerFunds,
  assertTokenCompatibility,
  validateAuthorizationForIntent,
} from "./validate.js";
import { deliverWebhook, buildWebhookPayload } from "./webhooks.js";

const paymentSettledEvent = parseAbiItem(
  "event PaymentSettled(uint256 indexed intentId, address indexed payer, address indexed merchant, uint256 amount, uint64 settledBlock)",
);

export async function submitSettlement(params: {
  cfg: RelayerConfig;
  intentId: string;
  auth: ReceiveAuthorization;
  idempotencyKey?: string;
  ip: string;
}) {
  const { cfg } = params;
  const intentId = BigInt(params.intentId);
  const auth: ReceiveAuthorization = {
    ...params.auth,
    from: getAddress(params.auth.from),
    to: getAddress(params.auth.to),
    signature: params.auth.signature,
  };

  const idemKey =
    params.idempotencyKey?.trim() || authFingerprint(params.intentId, auth.nonce, auth.from);
  const existing = getIdem(idemKey);
  if (existing) {
    if (existing.status === "SUCCESS" || existing.status === "SUBMITTED" || existing.status === "IN_FLIGHT") {
      return {
        duplicate: true,
        status: existing.status,
        txHash: existing.txHash,
        intentId: existing.intentId,
        result: existing.result,
      };
    }
  }

  await assertTokenCompatibility(cfg);

  const { intent } = await validateAuthorizationForIntent({ cfg, intentId, auth });

  const limits = enforceSubmitLimits({
    ip: params.ip,
    payer: auth.from,
    merchant: intent.merchant,
    globalPerMin: cfg.rateGlobalPerMin,
    payerPerMin: cfg.ratePayerPerMin,
    ipPerMin: cfg.rateIpPerMin,
    merchantPerMin: cfg.rateMerchantPerMin,
  });
  if (!limits.ok) {
    throw new RelayerError("RATE_LIMITED", "Relayer rate limit exceeded", {
      retryAfterSec: limits.retryAfterSec,
    });
  }

  putIdem(
    {
      key: idemKey,
      intentId: params.intentId,
      txHash: null,
      status: "IN_FLIGHT",
      createdAt: Date.now(),
    },
    cfg.idemTtlMs,
  );

  const account = getRelayerAccount();
  await assertRelayerFunds(cfg, account.address);

  const wallet = getWalletClient();
  const publicClient = getPublicClient();

  const data = encodeFunctionData({
    abi: paymentProcessorAbi,
    functionName: "settleWithAuthorization",
    args: [
      intentId,
      {
        from: auth.from,
        to: auth.to,
        value: auth.value,
        validAfter: auth.validAfter,
        validBefore: auth.validBefore,
        nonce: auth.nonce,
        signature: auth.signature,
      },
    ],
  });

  // Estimate gas; reject unbounded spends.
  let gas: bigint;
  try {
    gas = await withRpcRetry("estimateGas", () =>
      publicClient.estimateGas({
        account: account.address,
        to: cfg.paymentProcessor,
        data,
      }),
    );
  } catch (err) {
    putIdem(
      {
        key: idemKey,
        intentId: params.intentId,
        txHash: null,
        status: "FAILED",
        createdAt: Date.now(),
      },
      cfg.idemTtlMs,
    );
    throw new RelayerError("TX_FAILED", "Gas estimation failed; authorization likely invalid onchain", {
      err: String(err),
    });
  }
  if (gas > cfg.maxGasPerTx) {
    throw new RelayerError("GAS_BUDGET_EXCEEDED", "Estimated gas exceeds per-tx cap", {
      gas: gas.toString(),
      max: cfg.maxGasPerTx.toString(),
    });
  }

  // Pending nonce avoids clashes after restart / parallel submits.
  const nonce = await withRpcRetry("txCount", () =>
    publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }),
  );

  let txHash: Hex;
  try {
    txHash = await wallet.sendTransaction({
      account,
      chain: wallet.chain,
      to: cfg.paymentProcessor,
      data,
      gas,
      nonce,
      // Only this function — never arbitrary calldata from user input beyond validated auth.
    });
  } catch (err) {
    putIdem(
      {
        key: idemKey,
        intentId: params.intentId,
        txHash: null,
        status: "FAILED",
        createdAt: Date.now(),
      },
      cfg.idemTtlMs,
    );
    logger.error("submit_failed", { intentId: params.intentId, err: String(err) });
    throw new RelayerError("TX_FAILED", "Failed to submit settlement transaction");
  }

  logger.info("tx_submitted", { intentId: params.intentId, txHash, nonce });
  setTxStatus({
    txHash,
    intentId: params.intentId,
    status: "SUBMITTED",
    updatedAt: Date.now(),
  });
  putIdem(
    {
      key: idemKey,
      intentId: params.intentId,
      txHash,
      status: "SUBMITTED",
      createdAt: Date.now(),
    },
    cfg.idemTtlMs,
  );

  const receipt = await withRpcRetry("waitReceipt", () =>
    publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1, timeout: 120_000 }),
  );

  if (receipt.status !== "success") {
    setTxStatus({
      txHash,
      intentId: params.intentId,
      status: "REVERTED",
      updatedAt: Date.now(),
    });
    putIdem(
      {
        key: idemKey,
        intentId: params.intentId,
        txHash,
        status: "FAILED",
        createdAt: Date.now(),
      },
      cfg.idemTtlMs,
    );
    throw new RelayerError("TX_FAILED", "Settlement transaction reverted", { txHash });
  }

  const effectiveGasPrice = receipt.effectiveGasPrice ?? 0n;
  recordSpend(receipt.gasUsed, effectiveGasPrice);

  // Verify PaymentSettled event — never mark complete from submit alone.
  let settled:
    | { payer: string; merchant: string; amount: string; settledBlock: string }
    | undefined;
  for (const log of receipt.logs) {
    if (!isAddressEqual(log.address, cfg.paymentProcessor)) continue;
    try {
      const decoded = decodeEventLog({
        abi: [paymentSettledEvent],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "PaymentSettled") continue;
      const args = decoded.args as {
        intentId: bigint;
        payer: `0x${string}`;
        merchant: `0x${string}`;
        amount: bigint;
        settledBlock: bigint;
      };
      if (args.intentId !== intentId) continue;
      if (!isAddressEqual(args.payer, auth.from)) continue;
      if (args.amount !== auth.value) continue;
      settled = {
        payer: args.payer,
        merchant: args.merchant,
        amount: args.amount.toString(),
        settledBlock: args.settledBlock.toString(),
      };
      break;
    } catch {
      // not this event
    }
  }

  if (!settled) {
    setTxStatus({
      txHash,
      intentId: params.intentId,
      status: "UNVERIFIED",
      updatedAt: Date.now(),
    });
    throw new RelayerError("PAYMENT_UNVERIFIED", "Receipt missing PaymentSettled for this intent", {
      txHash,
    });
  }

  // Re-read intent as final authority.
  const finalIntent = await withRpcRetry("getIntent_final", () =>
    publicClient.readContract({
      address: cfg.paymentProcessor,
      abi: paymentProcessorAbi,
      functionName: "getIntent",
      args: [intentId],
    }),
  );
  const fi = finalIntent as { status: number; paidAmount: bigint; payerSettled: `0x${string}` };
  // Settled = 2
  if (fi.status !== 2 || fi.paidAmount !== auth.value) {
    throw new RelayerError("PAYMENT_UNVERIFIED", "Onchain intent not SETTLED after receipt", {
      txHash,
      status: fi.status,
    });
  }

  const result = {
    duplicate: false,
    status: "SUCCESS" as const,
    txHash,
    intentId: params.intentId,
    confirmationStage: "soft" as const,
    settled,
    explorerUrl: `${cfg.explorerUrl}/tx/${txHash}`,
    gasUsed: receipt.gasUsed.toString(),
  };

  setTxStatus({
    txHash,
    intentId: params.intentId,
    status: "SUCCESS",
    updatedAt: Date.now(),
  });
  putIdem(
    {
      key: idemKey,
      intentId: params.intentId,
      txHash,
      status: "SUCCESS",
      createdAt: Date.now(),
      result,
    },
    cfg.idemTtlMs,
  );

  // Best-effort webhook — not durable.
  try {
    const biz = await publicClient.readContract({
      address: cfg.businessRegistry,
      abi: (
        await import("./abis.js")
      ).businessRegistryAbi,
      functionName: "getBusiness",
      args: [intent.merchant],
    });
    const webhookUrl = (biz as { webhookUrl: string }).webhookUrl;
    if (webhookUrl) {
      const payload = buildWebhookPayload("payment.settled", {
        intentId: params.intentId,
        amountBase: auth.value.toString(),
        txHash,
        confirmationStage: "soft",
        payer: auth.from,
        merchant: intent.merchant,
      });
      void deliverWebhook({
        url: webhookUrl,
        payload,
        secret: cfg.webhookSigningSecret,
        eventKey: `${cfg.chainId}:${txHash}:settled`,
      });
    }
  } catch (err) {
    logger.warn("webhook_skip", { err: String(err) });
  }

  logger.info("settlement_verified", {
    intentId: params.intentId,
    txHash,
    amount: auth.value.toString(),
  });

  return result;
}
