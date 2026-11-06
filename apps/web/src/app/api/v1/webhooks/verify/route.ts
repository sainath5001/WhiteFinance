import { z } from "zod";
import { handle, options, parseJson } from "@/lib/http";
import { verifyWebhookSignature } from "@/lib/services/webhooks";
import { config } from "@/lib/config";
import { ApiError } from "@/lib/errors";

const schema = z.object({
  rawBody: z.string().min(2),
  signature: z.string().min(1),
  secret: z.string().min(1).optional(),
});

/**
 * Helper for merchant servers to check HMAC locally during integration tests.
 * Production merchants should verify with their own secret copy — never send
 * production secrets to this endpoint in public deployments.
 */
export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request) {
  return handle(
    req,
    async () => {
      const body = await parseJson(req, schema);
      const secret = body.secret || config.webhookSigningSecret;
      if (!secret) {
        throw new ApiError("VALIDATION_ERROR", "No webhook secret configured or provided");
      }
      const valid = verifyWebhookSignature(body.rawBody, body.signature, secret);
      return { valid };
    },
    "write",
  );
}
