import type { RelayerConfig } from "./config.js";
import { getBudgetState, remainingBudget } from "./budget.js";
import { getPublicClient, getRelayerAccount, withRpcRetry } from "./clients.js";
import { assertTokenCompatibility } from "./validate.js";
import { localDomainSeparator } from "./eip3009.js";

export async function getHealth(cfg: RelayerConfig) {
  const account = getRelayerAccount();
  const client = getPublicClient();
  const [chainId, balance, latest, token] = await Promise.all([
    withRpcRetry("chainId", () => client.getChainId()),
    withRpcRetry("balance", () => client.getBalance({ address: account.address })),
    withRpcRetry("latest", () => client.getBlockNumber()),
    assertTokenCompatibility(cfg).catch((err) => ({ error: String(err) })),
  ]);

  return {
    ok: !cfg.paused && chainId === cfg.chainId && typeof token === "object" && !("error" in token),
    paused: cfg.paused,
    chainId,
    expectedChainId: cfg.chainId,
    latestBlock: latest.toString(),
    relayer: account.address,
    wbtBalanceWei: balance.toString(),
    budget: {
      ...getBudgetState(),
      remainingWei: remainingBudget(cfg.maxWbtPerDayWei).toString(),
      maxPerDayWei: cfg.maxWbtPerDayWei.toString(),
    },
    limits: {
      maxAmountBase: cfg.maxAmountBase.toString(),
      maxGasPerTx: cfg.maxGasPerTx.toString(),
      minWbtWei: cfg.minWbtWei.toString(),
    },
    contracts: {
      usdt: cfg.usdt,
      paymentProcessor: cfg.paymentProcessor,
      businessRegistry: cfg.businessRegistry,
    },
    eip712: {
      name: cfg.usdtName,
      version: cfg.usdtVersion,
      localDomainSeparator: localDomainSeparator(cfg),
      tokenCheck: token,
    },
    durability: {
      database: false,
      idempotency: "in-memory-15m",
      webhooks: "best-effort-not-durable",
      note: "Chain is source of truth. Do not treat relayer memory as settlement proof.",
    },
  };
}
