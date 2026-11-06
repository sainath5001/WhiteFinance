import { createHmac, randomUUID } from "node:crypto";
import { logger } from "./logger.js";

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

const processed = new Set<string>();
const RETRY_DELAYS_MS = [1_000, 4_000, 10_000];

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

export function signWebhookBody(rawBody: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

/**
 * Best-effort delivery. In-memory retries only. Not durable across process restarts.
 */
export async function deliverWebhook(params: {
  url: string;
  payload: WebhookPayload;
  secret: string;
  eventKey?: string;
}): Promise<{ delivered: boolean; attempts: number; lastError?: string }> {
  if (!params.secret) {
    return { delivered: false, attempts: 0, lastError: "missing_signing_secret" };
  }
  if (params.eventKey && processed.has(params.eventKey)) {
    return { delivered: true, attempts: 0 };
  }

  const rawBody = JSON.stringify(params.payload);
  const signature = signWebhookBody(rawBody, params.secret);
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
        if (params.eventKey) processed.add(params.eventKey);
        logger.info("webhook_delivered", { type: params.payload.type, attempt: i + 1 });
        return { delivered: true, attempts: i + 1 };
      }
      lastError = `http_${res.status}`;
    } catch (err) {
      lastError = String(err);
    }
    if (i < RETRY_DELAYS_MS.length - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
    }
  }

  logger.error("webhook_dropped", {
    type: params.payload.type,
    lastError,
    note: "Not durable without a database",
  });
  return { delivered: false, attempts: RETRY_DELAYS_MS.length, lastError };
}
