import { handle, options, parseJson } from "@/lib/http";
import { z } from "zod";
import { addressSchema, hexSchema } from "@/lib/schemas";
import { proxyRelayer, relayerEnabled } from "@/lib/services/relayer-proxy";
import { ApiError } from "@/lib/errors";

const authorizationSchema = z.object({
  from: addressSchema,
  to: addressSchema,
  value: z.string().regex(/^\d+$/),
  validAfter: z.string().regex(/^\d+$/),
  validBefore: z.string().regex(/^\d+$/),
  nonce: hexSchema,
  signature: hexSchema,
});

const schema = z.object({
  intentId: z.string().regex(/^\d+$/),
  authorization: authorizationSchema,
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request) {
  return handle(
    req,
    async () => {
      if (!relayerEnabled()) {
        throw new ApiError(
          "RELAYER_UNAVAILABLE",
          "Relayer worker is not configured. Use gasful PaymentProcessor.pay.",
        );
      }
      const body = await parseJson(req, schema);
      const idem = req.headers.get("idempotency-key") || body.idempotencyKey;
      const proxied = await proxyRelayer("/submit", {
        method: "POST",
        headers: idem ? { "Idempotency-Key": idem } : undefined,
        body: JSON.stringify({
          intentId: body.intentId,
          authorization: body.authorization,
          idempotencyKey: idem,
        }),
        timeoutMs: 120_000,
      });
      if (proxied.status >= 400) {
        const err = proxied.body as {
          error?: { code?: string; message?: string; details?: object };
        };
        throw new ApiError(
          (err.error?.code as never) || "RELAYER_UNAVAILABLE",
          err.error?.message || "Relayer submit failed",
          (err.error?.details as Record<string, unknown>) || {},
        );
      }
      return proxied.body;
    },
    "write",
  );
}
