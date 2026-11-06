import type { PublicClient } from "viem";
import { withRpcRetry } from "./client";

export type ConfirmationStage = "soft" | "safe" | "finalized" | null;

export type ChainHeads = {
  latest: bigint;
  safe: bigint | null;
  finalized: bigint | null;
};

export async function getChainHeads(client: PublicClient): Promise<ChainHeads> {
  const latest = await withRpcRetry("latest_block", () => client.getBlockNumber());
  let safe: bigint | null = null;
  let finalized: bigint | null = null;
  try {
    const b = await client.getBlock({ blockTag: "safe" });
    safe = b.number;
  } catch {
    safe = null;
  }
  try {
    const b = await client.getBlock({ blockTag: "finalized" });
    finalized = b.number;
  } catch {
    finalized = null;
  }
  return { latest, safe, finalized };
}

export function confirmationStage(
  settledBlock: bigint | null | undefined,
  heads: ChainHeads,
): ConfirmationStage {
  if (settledBlock == null || settledBlock === 0n) return null;
  if (heads.finalized != null && settledBlock <= heads.finalized) return "finalized";
  if (heads.safe != null && settledBlock <= heads.safe) return "safe";
  if (settledBlock <= heads.latest) return "soft";
  // Settled block ahead of latest implies stale cache or reorg in progress.
  return "soft";
}

/**
 * Detect a soft-confirmation reorg: the settlement block is below the current
 * tip enough that we re-check whether the receipt/log is still present.
 */
export function maybeReorged(settledBlock: bigint, heads: ChainHeads): boolean {
  return settledBlock > heads.latest;
}
