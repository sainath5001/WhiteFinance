import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config";
import { logger } from "../logger";

export type Checkpoint = {
  chainId: number;
  lastScannedBlock: string;
  updatedAt: string;
  note: string;
};

/**
 * Optional local development checkpoint file.
 * NOT shared storage. NOT authoritative. Lost on ephemeral hosts.
 * Chain reads remain source of truth.
 */
export async function readCheckpoint(): Promise<Checkpoint | null> {
  try {
    const raw = await fs.readFile(path.resolve(config.checkpointFile), "utf8");
    return JSON.parse(raw) as Checkpoint;
  } catch {
    return null;
  }
}

export async function writeCheckpoint(lastScannedBlock: bigint): Promise<void> {
  const file = path.resolve(config.checkpointFile);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const payload: Checkpoint = {
    chainId: config.chainId,
    lastScannedBlock: lastScannedBlock.toString(),
    updatedAt: new Date().toISOString(),
    note: "Non-authoritative local development checkpoint only.",
  };
  await fs.writeFile(file, JSON.stringify(payload, null, 2));
  logger.info("checkpoint_written", { lastScannedBlock: lastScannedBlock.toString() });
}
