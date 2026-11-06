import { handle, options } from "@/lib/http";
import { proxyRelayer, relayerEnabled } from "@/lib/services/relayer-proxy";
import { config } from "@/lib/config";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request) {
  return handle(req, async () => {
    if (!relayerEnabled()) {
      return {
        ok: false,
        available: false,
        reason: "RELAYER_URL not set",
        features: config.features,
      };
    }
    const proxied = await proxyRelayer("/health", { method: "GET", timeoutMs: 15_000 });
    return {
      available: true,
      upstreamStatus: proxied.status,
      ...(proxied.body as object),
    };
  });
}
