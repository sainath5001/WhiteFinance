import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { RelayerConfig } from "./config.js";
import { whitechainSepolia } from "./chain.js";
import { RelayerError } from "./errors.js";
import { logger } from "./logger.js";

let publicClient: PublicClient | null = null;
let walletClient: WalletClient | null = null;
let account: Account | null = null;

export function initClients(cfg: RelayerConfig) {
  const chain = whitechainSepolia(cfg);
  publicClient = createPublicClient({
    chain,
    transport: http(cfg.rpcUrl, { timeout: 20_000, retryCount: 2 }),
  });
  if (cfg.privateKey) {
    account = privateKeyToAccount(cfg.privateKey);
    walletClient = createWalletClient({
      account,
      chain,
      transport: http(cfg.rpcUrl, { timeout: 20_000, retryCount: 2 }),
    });
  }
  return { publicClient, walletClient, account };
}

export function getPublicClient(): PublicClient {
  if (!publicClient) throw new Error("Public client not initialized");
  return publicClient;
}

export function getWalletClient(): WalletClient {
  if (!walletClient || !account) {
    throw new RelayerError("INTERNAL_ERROR", "Relayer wallet is not configured");
  }
  return walletClient;
}

export function getRelayerAccount(): Account {
  if (!account) throw new RelayerError("INTERNAL_ERROR", "Relayer wallet is not configured");
  return account;
}

/** Test helper */
export function setClientsForTests(opts: {
  publicClient?: PublicClient | null;
  walletClient?: WalletClient | null;
  account?: Account | null;
}) {
  if ("publicClient" in opts) publicClient = opts.publicClient ?? null;
  if ("walletClient" in opts) walletClient = opts.walletClient ?? null;
  if ("account" in opts) account = opts.account ?? null;
}

export async function withRpcRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 4,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const delay = Math.min(8_000, 250 * 2 ** i);
      logger.warn("rpc_retry", { label, attempt: i + 1, delay });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new RelayerError("CHAIN_UNAVAILABLE", `RPC unavailable while ${label}`, {
    err: String(last),
  });
}

export type { Hex };
