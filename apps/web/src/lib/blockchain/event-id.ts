import type { Hex, Log } from "viem";

/** Canonical event identity for idempotent processing. */
export function eventId(input: {
  chainId: number;
  transactionHash: Hex;
  logIndex: number;
}): string {
  return `${input.chainId}:${input.transactionHash.toLowerCase()}:${input.logIndex}`;
}

export function eventIdFromLog(chainId: number, log: Log): string {
  if (!log.transactionHash || log.logIndex == null) {
    throw new Error("Log missing transactionHash or logIndex");
  }
  return eventId({
    chainId,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
  });
}
