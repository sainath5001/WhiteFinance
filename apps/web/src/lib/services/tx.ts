import type { Hex } from "viem";
import { getAddress } from "viem";
import { config, explorerTx } from "../config";
import { ApiError } from "../errors";
import { getPublicClient, withRpcRetry } from "../blockchain/client";
import {
  confirmationStage,
  getChainHeads,
  maybeReorged,
} from "../blockchain/confirmations";
import { getReceipt } from "../blockchain/verify";

export async function getTransactionStatus(txHash: Hex) {
  const client = getPublicClient();
  const heads = await getChainHeads(client);

  let receipt;
  try {
    receipt = await getReceipt(txHash);
  } catch (err) {
    if (err instanceof ApiError && err.code === "TX_NOT_FOUND") {
      // Pending or unknown — try getTransaction
      const tx = await withRpcRetry("get_tx", () => client.getTransaction({ hash: txHash })).catch(
        () => null,
      );
      if (!tx) throw err;
      return {
        txHash,
        status: "PENDING" as const,
        blockNumber: null,
        blockHash: null,
        confirmationStage: null,
        reorged: false,
        to: tx.to ? getAddress(tx.to) : null,
        explorerUrl: explorerTx(txHash),
      };
    }
    throw err;
  }

  const reorged = maybeReorged(receipt.blockNumber, heads);
  const stage = reorged ? null : confirmationStage(receipt.blockNumber, heads);

  return {
    txHash,
    status: receipt.status === "success" ? ("SUCCESS" as const) : ("REVERTED" as const),
    blockNumber: receipt.blockNumber.toString(),
    blockHash: receipt.blockHash,
    confirmationStage: stage,
    reorged,
    to: receipt.to ? getAddress(receipt.to) : null,
    knownContract:
      receipt.to != null
        ? Object.entries(config.contracts).find(
            ([, a]) => getAddress(a) === getAddress(receipt.to!),
          )?.[0] ?? null
        : null,
    explorerUrl: explorerTx(txHash),
  };
}
