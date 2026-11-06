import {
  type Address,
  type Hex,
  getAddress,
  isAddressEqual,
  zeroAddress,
} from "viem";
import { businessRegistryAbi, paymentProcessorAbi, prizeUsdtAbi } from "./abis.js";
import type { RelayerConfig } from "./config.js";
import { getPublicClient, withRpcRetry } from "./clients.js";
import { RelayerError } from "./errors.js";
import {
  type ReceiveAuthorization,
  assertPackedEoaSignature,
  authorizationWindowStatus,
  localDomainSeparator,
  recoverAuthorizationSigner,
} from "./eip3009.js";
import { remainingBudget } from "./budget.js";

export type IntentView = {
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

export async function readIntent(cfg: RelayerConfig, intentId: bigint): Promise<IntentView> {
  const client = getPublicClient();
  try {
    const intent = await withRpcRetry("getIntent", () =>
      client.readContract({
        address: cfg.paymentProcessor,
        abi: paymentProcessorAbi,
        functionName: "getIntent",
        args: [intentId],
      }),
    );
    return intent as IntentView;
  } catch {
    throw new RelayerError("INTENT_NOT_FOUND", `Payment intent ${intentId} does not exist`);
  }
}

export async function assertTokenCompatibility(cfg: RelayerConfig) {
  const client = getPublicClient();
  const chainId = await withRpcRetry("chainId", () => client.getChainId());
  if (chainId !== cfg.chainId) {
    throw new RelayerError("WRONG_CHAIN", `Connected chain ${chainId} != configured ${cfg.chainId}`);
  }

  const [name, decimals, domain, processorUsdt] = await Promise.all([
    withRpcRetry("name", () =>
      client.readContract({ address: cfg.usdt, abi: prizeUsdtAbi, functionName: "name" }),
    ),
    withRpcRetry("decimals", () =>
      client.readContract({ address: cfg.usdt, abi: prizeUsdtAbi, functionName: "decimals" }),
    ),
    withRpcRetry("DOMAIN_SEPARATOR", () =>
      client.readContract({
        address: cfg.usdt,
        abi: prizeUsdtAbi,
        functionName: "DOMAIN_SEPARATOR",
      }),
    ),
    withRpcRetry("processor_usdt", () =>
      client.readContract({
        address: cfg.paymentProcessor,
        abi: paymentProcessorAbi,
        functionName: "usdt",
      }),
    ),
  ]);

  if (name !== cfg.usdtName) {
    throw new RelayerError("WRONG_TOKEN", `USDT name mismatch: ${name}`);
  }
  if (Number(decimals) !== 6) {
    throw new RelayerError("WRONG_TOKEN", `USDT decimals must be 6, got ${decimals}`);
  }
  if (!isAddressEqual(getAddress(processorUsdt as Address), cfg.usdt)) {
    throw new RelayerError("WRONG_TOKEN", "PaymentProcessor.usdt() does not match prize USDT");
  }

  const local = localDomainSeparator(cfg);
  if ((domain as Hex).toLowerCase() !== local.toLowerCase()) {
    throw new RelayerError("DOMAIN_MISMATCH", "Local EIP-712 domain does not match onchain DOMAIN_SEPARATOR", {
      onchain: domain,
      local,
      expectedCached: cfg.expectedDomainSeparator,
    });
  }
  if ((domain as Hex).toLowerCase() !== cfg.expectedDomainSeparator.toLowerCase()) {
    throw new RelayerError("DOMAIN_MISMATCH", "Onchain DOMAIN_SEPARATOR drifted from known prize USDT value", {
      onchain: domain,
      expected: cfg.expectedDomainSeparator,
    });
  }

  return { name, decimals: Number(decimals), domain: domain as Hex, chainId };
}

export async function validateAuthorizationForIntent(params: {
  cfg: RelayerConfig;
  intentId: bigint;
  auth: ReceiveAuthorization;
  nowSec?: number;
}) {
  const { cfg, intentId, auth } = params;
  const nowSec = params.nowSec ?? Math.floor(Date.now() / 1000);

  if (cfg.paused) {
    throw new RelayerError("RELAYER_PAUSED", "Relayer is paused");
  }

  try {
    assertPackedEoaSignature(auth.signature);
  } catch {
    throw new RelayerError("AUTH_INVALID", "Signature must be 65-byte r||s||v");
  }

  if (!isAddressEqual(auth.to, cfg.paymentProcessor)) {
    throw new RelayerError("WRONG_RECIPIENT", "Authorization to must be PaymentProcessor", {
      to: auth.to,
      expected: cfg.paymentProcessor,
    });
  }

  const intent = await readIntent(cfg, intentId);

  // Types.IntentStatus: None=0, Created=1, Settled=2, ...
  if (intent.status !== 1) {
    throw new RelayerError("INTENT_NOT_CREATED", "Intent is not in CREATED status", {
      status: intent.status,
    });
  }
  if (BigInt(nowSec) >= intent.expiresAt) {
    throw new RelayerError("INTENT_EXPIRED", "Payment intent has expired");
  }
  if (auth.value !== intent.amount) {
    throw new RelayerError("WRONG_AMOUNT", "Authorization value does not match intent amount", {
      authValue: auth.value.toString(),
      intentAmount: intent.amount.toString(),
    });
  }
  if (auth.value > cfg.maxAmountBase) {
    throw new RelayerError("AMOUNT_EXCEEDS_LIMIT", "Amount exceeds relayer max", {
      max: cfg.maxAmountBase.toString(),
    });
  }
  if (intent.payer !== zeroAddress && !isAddressEqual(auth.from, intent.payer)) {
    throw new RelayerError("PAYER_MISMATCH", "Authorization from does not match bound payer");
  }

  const window = authorizationWindowStatus(nowSec, auth.validAfter, auth.validBefore);
  if (window === "early") {
    throw new RelayerError("AUTH_EARLY", "Authorization validAfter has not passed (exclusive bound)");
  }
  if (window === "expired") {
    throw new RelayerError("AUTH_EXPIRED", "Authorization validBefore has passed (exclusive bound)");
  }
  // Also require auth window to finish before intent expires for safer ops.
  if (auth.validBefore > intent.expiresAt) {
    throw new RelayerError(
      "VALIDATION_ERROR",
      "Authorization validBefore must be <= intent expiresAt",
    );
  }

  const client = getPublicClient();
  const recovered = await recoverAuthorizationSigner(cfg, auth).catch(() => {
    throw new RelayerError("AUTH_INVALID", "Could not recover signer from authorization");
  });
  if (!isAddressEqual(recovered, auth.from)) {
    throw new RelayerError("AUTH_INVALID", "Signature does not recover to auth.from", {
      recovered,
      from: auth.from,
    });
  }

  const [used, fromBlocked, processorBlocked, payoutBlocked, balance, merchant] =
    await Promise.all([
      withRpcRetry("authorizationState", () =>
        client.readContract({
          address: cfg.usdt,
          abi: prizeUsdtAbi,
          functionName: "authorizationState",
          args: [auth.from, auth.nonce],
        }),
      ),
      withRpcRetry("isBlocked_from", () =>
        client.readContract({
          address: cfg.usdt,
          abi: prizeUsdtAbi,
          functionName: "isBlocked",
          args: [auth.from],
        }),
      ),
      withRpcRetry("isBlocked_pp", () =>
        client.readContract({
          address: cfg.usdt,
          abi: prizeUsdtAbi,
          functionName: "isBlocked",
          args: [cfg.paymentProcessor],
        }),
      ),
      withRpcRetry("isBlocked_payout", () =>
        client.readContract({
          address: cfg.usdt,
          abi: prizeUsdtAbi,
          functionName: "isBlocked",
          args: [intent.payoutAddress],
        }),
      ),
      withRpcRetry("balanceOf", () =>
        client.readContract({
          address: cfg.usdt,
          abi: prizeUsdtAbi,
          functionName: "balanceOf",
          args: [auth.from],
        }),
      ),
      withRpcRetry("getBusiness", () =>
        client.readContract({
          address: cfg.businessRegistry,
          abi: businessRegistryAbi,
          functionName: "getBusiness",
          args: [intent.merchant],
        }),
      ),
    ]);

  if (used) {
    throw new RelayerError("AUTH_NONCE_USED", "Authorization nonce already used or canceled");
  }
  if (fromBlocked || processorBlocked || payoutBlocked) {
    throw new RelayerError("PAYER_BLOCKED", "Payer, processor, or payout is blocked on prize USDT");
  }
  if ((balance as bigint) < auth.value) {
    throw new RelayerError("INSUFFICIENT_USDT", "Customer USDT balance is below authorization value");
  }

  const biz = merchant as { active: boolean; account: Address };
  if (!biz.active || biz.account === zeroAddress) {
    throw new RelayerError("MERCHANT_INACTIVE", "Merchant is not an active registered business");
  }

  return { intent, recovered };
}

export async function assertRelayerFunds(cfg: RelayerConfig, relayerAddress: Address) {
  const client = getPublicClient();
  const bal = await withRpcRetry("relayer_balance", () =>
    client.getBalance({ address: relayerAddress }),
  );
  if (bal < cfg.minWbtWei) {
    throw new RelayerError("INSUFFICIENT_RELAYER_WBT", "Relayer WBT balance below minimum", {
      balanceWei: bal.toString(),
      minWei: cfg.minWbtWei.toString(),
    });
  }
  const remaining = remainingBudget(cfg.maxWbtPerDayWei);
  if (remaining === 0n) {
    throw new RelayerError("GAS_BUDGET_EXCEEDED", "Daily WBT gas budget exhausted");
  }
  return { balanceWei: bal, budgetRemainingWei: remaining };
}
