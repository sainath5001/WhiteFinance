import { config } from "../config";
import { ApiError } from "../errors";
import { logger } from "../logger";

export function relayerEnabled() {
  return Boolean(config.relayerUrl);
}

export async function proxyRelayer(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ status: number; body: unknown }> {
  if (!config.relayerUrl) {
    throw new ApiError(
      "RELAYER_UNAVAILABLE",
      "Relayer worker URL is not configured. Set RELAYER_URL.",
    );
  }

  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (config.relayerInternalToken) {
    headers.set("X-Relayer-Token", config.relayerInternalToken);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 60_000);

  try {
    const res = await fetch(`${config.relayerUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({
      error: { code: "RELAYER_UNAVAILABLE", message: "Invalid JSON from relayer" },
    }));
    return { status: res.status, body };
  } catch (err) {
    logger.warn("relayer_proxy_failed", { path, err: String(err) });
    throw new ApiError("RELAYER_UNAVAILABLE", "Relayer worker is unreachable");
  } finally {
    clearTimeout(timeout);
  }
}
