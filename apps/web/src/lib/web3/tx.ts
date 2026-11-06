import {
  type Hash,
  type Log,
  type TransactionReceipt,
  decodeEventLog,
  type Abi,
} from "viem";
import { waitForTransactionReceipt } from "wagmi/actions";
import { wagmiConfig } from "@/lib/web3/wagmi";
import { explorerTx } from "@/lib/config";

export type TxPhase =
  | "idle"
  | "wallet"
  | "pending"
  | "soft"
  | "failed"
  | "rejected";

export async function waitSoftReceipt(hash: Hash): Promise<TransactionReceipt> {
  return waitForTransactionReceipt(wagmiConfig, {
    hash,
    confirmations: 1,
  });
}

export function findEventArgs<T>(
  receipt: TransactionReceipt,
  abi: Abi,
  eventName: string,
  address?: string,
): T | null {
  for (const log of receipt.logs as Log[]) {
    if (address && log.address.toLowerCase() !== address.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === eventName) {
        return decoded.args as T;
      }
    } catch {
      // skip
    }
  }
  return null;
}

export function receiptExplorer(hash: Hash) {
  return explorerTx(hash);
}

export async function pollUntil<T>(
  fn: () => Promise<T>,
  ok: (value: T) => boolean,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<T> {
  const intervalMs = opts.intervalMs ?? 2000;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const value = await fn();
    if (ok(value)) return value;
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for onchain/backend confirmation");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
