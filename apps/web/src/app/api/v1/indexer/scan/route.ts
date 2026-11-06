import { paymentProcessorAbi } from "@/lib/abis";
import { advanceCheckpoint, scanContractEvents } from "@/lib/blockchain/scanner";
import { readCheckpoint } from "@/lib/blockchain/checkpoint";
import { config } from "@/lib/config";
import { handle, options } from "@/lib/http";

/**
 * Manual indexer tick for local demos.
 * Scans recent PaymentSettled events, advances a non-authoritative checkpoint,
 * and returns newly seen event IDs. Not a durable queue.
 */
export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request) {
  return handle(
    req,
    async () => {
      const checkpoint = await readCheckpoint();
      const fromBlock = checkpoint
        ? BigInt(checkpoint.lastScannedBlock) + 1n
        : config.deploymentBlock;

      const events = await scanContractEvents({
        address: config.contracts.paymentProcessor,
        abi: paymentProcessorAbi,
        eventName: "PaymentSettled",
        fromBlock,
        maxLogs: 100,
      });

      const toBlock =
        events.length > 0
          ? events.reduce((m, e) => (e.blockNumber > m ? e.blockNumber : m), 0n)
          : fromBlock;

      const { newlyProcessed } = await advanceCheckpoint(
        toBlock,
        events.map((e) => e.id),
      );

      return {
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
        scanned: events.length,
        newlyProcessed: newlyProcessed.length,
        eventIds: newlyProcessed,
        checkpoint: await readCheckpoint(),
        limitations: {
          durable: false,
          sharedAcrossInstances: false,
          authoritative: false,
          note: "Checkpoint is local/dev only. Re-scan from deploymentBlock after restart or lost file.",
        },
      };
    },
    "write",
  );
}
