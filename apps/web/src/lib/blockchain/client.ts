import {
  createPublicClient,
  http,
  fallback,
  type PublicClient,
  type Transport,
} from "viem";
import { whitechainSepolia } from "../chain";
import { config } from "../config";
import { ApiError } from "../errors";
import { logger } from "../logger";

let cached: PublicClient | null = null;

function buildTransport(): Transport {
  const urls = [config.rpcUrl];
  if (process.env.ANKR_RPC_URL) urls.push(process.env.ANKR_RPC_URL);
  const transports = urls.map((url) =>
    http(url, {
      timeout: 20_000,
      retryCount: 2,
      retryDelay: 500,
    }),
  );
  return transports.length === 1 ? transports[0]! : fallback(transports);
}

export function getPublicClient(): PublicClient {
  if (!cached) {
    cached = createPublicClient({
      chain: whitechainSepolia,
      transport: buildTransport(),
    });
  }
  return cached;
}

/** Test helper to inject a mock client. */
export function setPublicClientForTests(client: PublicClient | null) {
  cached = client;
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
  logger.error("rpc_failed", { label, err: String(last) });
  throw new ApiError("CHAIN_UNAVAILABLE", `RPC unavailable while ${label}`);
}
