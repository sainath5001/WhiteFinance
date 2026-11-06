import { createHmac, randomUUID } from "node:crypto";
import { config } from "../config";
import { logger } from "../logger";
import { markProcessed, hasProcessed } from "../blockchain/scanner";

export type WebhookEventType =
  | "payment.settled"
  | "payment.refunded"
  | "payment.expired"
  | "invoice.confirmed"
  | "financing.funded"
  | "financing.repaid";

export type WebhookPayload = {
  id: string;
  type: WebhookEventType;
  createdAt: number;
  data: Record<string, unknown>;
};

/**
 * Best-effort webhook delivery.
 * Retries are in-memory only (1s / 4s / 10s). Not durable. Not at-least-once across restarts.
 * Merchants must re-read the payment from the API/chain before fulfilling.
 */
export function buildWebhookPayload(
  type: WebhookEventType,
  data: Record<string, unknown>,
  idempotencyKey?: string,
): WebhookPayload {
  return {
    id: idempotencyKey || `evt_${randomUUID()}`,
    type,
    createdAt: Math.floor(Date.now() / 1000),
    data,
  };
}

export function signWebhookBody(rawBody: string, secret = config.webhookSigningSecret): string {
  if (!secret) {
    throw new Error("WEBHOOK_SIGNING_SECRET is not configured");
  }
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = signWebhookBody(rawBody, secret);
  if (expected.length !== signatureHeader.length) return false;
  // timing-safe-ish compare
  let ok = 0;
  for (let i = 0; i < expected.length; i++) {
    ok |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return ok === 0;
}

const RETRY_DELAYS_MS = [1_000, 4_000, 10_000];

export async function deliverWebhook(params: {
  url: string;
  payload: WebhookPayload;
  /** Event identity for in-process idempotency, e.g. chainId:tx:logIndex */
  eventKey?: string;
}): Promise<{ delivered: boolean; attempts: number; lastError?: string }> {
  if (params.eventKey) {
    if (hasProcessed(`webhook:${params.eventKey}`)) {
      return { delivered: true, attempts: 0 };
    }
  }

  const rawBody = JSON.stringify(params.payload);
  let signature: string;
  try {
    signature = signWebhookBody(rawBody);
  } catch (err) {
    logger.warn("webhook_secret_missing", { err: String(err) });
    return { delivered: false, attempts: 0, lastError: "missing_signing_secret" };
  }

  let lastError: string | undefined;
  for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(params.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WhiteFinance-Signature": signature,
          "Idempotency-Key": params.payload.id,
        },
        body: rawBody,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        if (params.eventKey) markProcessed(`webhook:${params.eventKey}`);
        logger.info("webhook_delivered", {
          type: params.payload.type,
          attempt: i + 1,
          status: res.status,
        });
        return { delivered: true, attempts: i + 1 };
      }
      lastError = `http_${res.status}`;
    } catch (err) {
      lastError = String(err);
    }
    logger.warn("webhook_retry", {
      type: params.payload.type,
      attempt: i + 1,
      lastError,
    });
    if (i < RETRY_DELAYS_MS.length - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
    }
  }

  logger.error("webhook_dropped", {
    type: params.payload.type,
    lastError,
    note: "In-memory retries exhausted. Delivery is not durable without a database.",
  });
  return { delivered: false, attempts: RETRY_DELAYS_MS.length, lastError };
}
