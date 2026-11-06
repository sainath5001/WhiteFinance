import { getPublicClient, withRpcRetry } from "@/lib/blockchain/client";
import { getChainHeads } from "@/lib/blockchain/confirmations";
import { config } from "@/lib/config";
import { handle, options } from "@/lib/http";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request) {
  return handle(req, async () => {
    const client = getPublicClient();
    const heads = await getChainHeads(client);
    const chainId = await withRpcRetry("chainId", () => client.getChainId());
    return {
      ok: true,
      chainId,
      expectedChainId: config.chainId,
      latestBlock: heads.latest.toString(),
      safeBlock: heads.safe?.toString() ?? null,
      finalizedBlock: heads.finalized?.toString() ?? null,
      deploymentBlock: config.deploymentBlock.toString(),
      contracts: config.contracts,
      features: config.features,
      relayer: {
        available: Boolean(config.relayerUrl),
        note: "Relayer worker is out of scope for this backend pass.",
      },
      storage: {
        database: false,
        checkpointFile: config.checkpointFile,
        note: "Chain is source of truth. Checkpoint file is optional and non-authoritative.",
      },
    };
  });
}
