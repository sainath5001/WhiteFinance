import { z } from "zod";
import { handle, options, parseJson } from "@/lib/http";
import {
  buildWebhookPayload,
  signWebhookBody,
  type WebhookEventType,
} from "@/lib/services/webhooks";
import { config } from "@/lib/config";
import { ApiError } from "@/lib/errors";

const schema = z.object({
  type: z.enum([
    "payment.settled",
    "payment.refunded",
    "payment.expired",
    "invoice.confirmed",
    "financing.funded",
    "financing.repaid",
  ]),
  data: z.record(z.unknown()),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

/**
 * Builds a signed webhook payload for integration testing.
 * Does not deliver. Delivery requires a merchant webhookUrl and is best-effort only.
 */
export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request) {
  return handle(
    req,
    async () => {
      const body = await parseJson(req, schema);
      const payload = buildWebhookPayload(
        body.type as WebhookEventType,
        body.data,
        body.idempotencyKey,
      );
      const rawBody = JSON.stringify(payload);
      let signature: string | null = null;
      if (config.webhookSigningSecret) {
        signature = signWebhookBody(rawBody);
      } else {
        throw new ApiError(
          "VALIDATION_ERROR",
          "WEBHOOK_SIGNING_SECRET is required to preview signed payloads",
        );
      }
      return {
        payload,
        rawBody,
        headers: {
          "Content-Type": "application/json",
          "X-WhiteFinance-Signature": signature,
          "Idempotency-Key": payload.id,
        },
        delivery: {
          guaranteed: false,
          retries: [1000, 4000, 10000],
          timeoutMs: 5000,
          note: "In-memory retries only. No durable queue without a database.",
        },
      };
    },
    "write",
  );
}
