import {
  type Abi,
  type Address,
  type GetContractEventsReturnType,
  type Hex,
  type Log,
  decodeEventLog,
  parseAbiItem,
} from "viem";
import { config } from "../config";
import { logger } from "../logger";
import { getPublicClient, withRpcRetry } from "./client";
import { eventIdFromLog } from "./event-id";
import { readCheckpoint, writeCheckpoint } from "./checkpoint";

const DEFAULT_CHUNK = 2_000n;

export type DecodedProtocolEvent = {
  id: string;
  chainId: number;
  address: Address;
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  transactionHash: Hex;
  logIndex: number;
  removed: boolean;
};

/** In-memory set of processed event IDs for this process lifetime only. */
const processed = new Set<string>();

export function resetProcessedEventsForTests() {
  processed.clear();
}

export function hasProcessed(id: string): boolean {
  return processed.has(id);
}

export function markProcessed(id: string): boolean {
  if (processed.has(id)) return false;
  processed.add(id);
  // Bound memory for long-running demos.
  if (processed.size > 20_000) {
    const first = processed.values().next().value;
    if (first) processed.delete(first);
  }
  return true;
}

export async function scanContractEvents(params: {
  address: Address;
  abi: Abi;
  eventName: string;
  args?: Record<string, unknown>;
  fromBlock?: bigint;
  toBlock?: bigint;
  maxLogs?: number;
}): Promise<DecodedProtocolEvent[]> {
  const client = getPublicClient();
  const latest = await withRpcRetry("scan_latest", () => client.getBlockNumber());
  const fromBlock = params.fromBlock ?? config.deploymentBlock;
  const toBlock = params.toBlock ?? latest;
  if (toBlock < fromBlock) return [];

  const out: DecodedProtocolEvent[] = [];
  const maxLogs = params.maxLogs ?? 200;

  for (let start = fromBlock; start <= toBlock; start += DEFAULT_CHUNK + 1n) {
    const end = start + DEFAULT_CHUNK > toBlock ? toBlock : start + DEFAULT_CHUNK;
    const logs = await withRpcRetry(`get_logs_${params.eventName}`, () =>
      client.getContractEvents({
        address: params.address,
        abi: params.abi,
        eventName: params.eventName as never,
        args: params.args as never,
        fromBlock: start,
        toBlock: end,
        strict: true,
      }),
    );

    for (const log of logs as GetContractEventsReturnType) {
      if (log.removed) continue;
      const id = eventIdFromLog(config.chainId, log as Log);
      out.push({
        id,
        chainId: config.chainId,
        address: log.address,
        eventName: params.eventName,
        args: (log.args ?? {}) as Record<string, unknown>,
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!,
        logIndex: log.logIndex!,
        removed: Boolean(log.removed),
      });
    }
    if (out.length >= maxLogs) break;
  }

  // Newest first for list endpoints.
  out.sort((a, b) => {
    if (a.blockNumber === b.blockNumber) return b.logIndex - a.logIndex;
    return a.blockNumber > b.blockNumber ? -1 : 1;
  });
  return out.slice(0, maxLogs);
}

/**
 * Advance a local non-authoritative checkpoint after a successful scan window.
 * Idempotent for already-seen event IDs within this process.
 */
export async function advanceCheckpoint(toBlock: bigint, eventIds: string[]): Promise<{
  newlyProcessed: string[];
}> {
  const newlyProcessed: string[] = [];
  for (const id of eventIds) {
    if (markProcessed(id)) newlyProcessed.push(id);
  }
  const existing = await readCheckpoint();
  const previous = existing ? BigInt(existing.lastScannedBlock) : 0n;
  if (toBlock > previous) {
    await writeCheckpoint(toBlock);
  }
  logger.info("checkpoint_advanced", {
    toBlock: toBlock.toString(),
    newlyProcessed: newlyProcessed.length,
  });
  return { newlyProcessed };
}

export function decodeRawLog(abi: Abi, log: Log) {
  return decodeEventLog({
    abi,
    data: log.data,
    topics: log.topics,
  });
}

export const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
