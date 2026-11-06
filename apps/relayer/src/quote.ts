import { type Address, type Hex, getAddress, keccak256, toBytes, zeroAddress } from "viem";
import type { RelayerConfig } from "./config.js";
import { buildTypedData } from "./eip3009.js";
import { RelayerError } from "./errors.js";
import { assertTokenCompatibility, readIntent } from "./validate.js";
import { getRelayerAccount } from "./clients.js";

export async function buildQuote(params: {
  cfg: RelayerConfig;
  intentId: string;
  payer?: Address | null;
}) {
  const { cfg } = params;
  if (cfg.paused) {
    return {
      available: false,
      pauseReason: "RELAYER_PAUSED",
      intentId: params.intentId,
    };
  }

  await assertTokenCompatibility(cfg);
  const intentId = BigInt(params.intentId);
  const intent = await readIntent(cfg, intentId);

  // Types.IntentStatus: None=0, Created=1, Settled=2, ...
  if (intent.status !== 1) {
    throw new RelayerError("INTENT_NOT_CREATED", "Intent is not payable (not CREATED)");
  }
  const now = Math.floor(Date.now() / 1000);
  if (BigInt(now) >= intent.expiresAt) {
    throw new RelayerError("INTENT_EXPIRED", "Payment intent has expired");
  }
  if (intent.amount > cfg.maxAmountBase) {
    throw new RelayerError("AMOUNT_EXCEEDS_LIMIT", "Intent amount exceeds relayer max");
  }

  let payer: Address;
  if (intent.payer !== zeroAddress) {
    payer = intent.payer;
    if (params.payer && getAddress(params.payer) !== payer) {
      throw new RelayerError("PAYER_MISMATCH", "Connected wallet is not the bound payer");
    }
  } else if (params.payer) {
    payer = getAddress(params.payer);
  } else {
    throw new RelayerError(
      "VALIDATION_ERROR",
      "payer address is required when the intent is open to any payer",
    );
  }

  const nonce = keccak256(toBytes(`wf:${intentId}:${payer}:${now}:${Math.random()}`)) as Hex;
  const validAfter = 0n;
  const authTtl = BigInt(cfg.authTtlSeconds);
  const intentLeft = intent.expiresAt - BigInt(now);
  const window = intentLeft < authTtl ? intentLeft : authTtl;
  if (window < 60n) {
    throw new RelayerError("INTENT_EXPIRED", "Intent expires too soon for a gasless window");
  }
  const validBefore = BigInt(now) + window;

  const message = {
    from: payer,
    to: cfg.paymentProcessor,
    value: intent.amount,
    validAfter,
    validBefore,
    nonce,
  };
  const typedData = buildTypedData(cfg, message);
  const account = getRelayerAccount();

  return {
    available: true,
    pauseReason: null,
    intentId: intentId.toString(),
    amountBase: intent.amount.toString(),
    token: cfg.usdt,
    paymentProcessor: cfg.paymentProcessor,
    merchant: intent.merchant,
    payoutAddress: intent.payoutAddress,
    expiresAt: Number(intent.expiresAt),
    relayer: account.address,
    plainLanguage: {
      summary: `Allow WhiteFinance PaymentProcessor to receive exactly ${intent.amount.toString()} base units of prize USDT from ${payer}, once, before unix ${validBefore.toString()}.`,
      token: "Tether USD (prize USDT)",
      recipient: cfg.paymentProcessor,
      amountBase: intent.amount.toString(),
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce,
    },
    typedData: {
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: {
        from: message.from,
        to: message.to,
        value: message.value.toString(),
        validAfter: message.validAfter.toString(),
        validBefore: message.validBefore.toString(),
        nonce: message.nonce,
      },
    },
    authorizationTemplate: {
      from: message.from,
      to: message.to,
      value: message.value.toString(),
      validAfter: message.validAfter.toString(),
      validBefore: message.validBefore.toString(),
      nonce: message.nonce,
    },
  };
}
