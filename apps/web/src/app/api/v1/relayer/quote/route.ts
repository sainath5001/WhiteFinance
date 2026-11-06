import { handle, options, parseJson } from "@/lib/http";
import { z } from "zod";
import { addressSchema } from "@/lib/schemas";
import { proxyRelayer, relayerEnabled } from "@/lib/services/relayer-proxy";
import { ApiError } from "@/lib/errors";
import { config } from "@/lib/config";

const schema = z.object({
  intentId: z.string().regex(/^\d+$/),
  id: z.string().regex(/^\d+$/).optional(),
  payer: addressSchema.optional().nullable(),
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
          "Start apps/relayer and set RELAYER_URL. Gasful pay remains available.",
          {
            paymentProcessor: config.contracts.paymentProcessor,
          },
        );
      }
      const body = await parseJson(req, schema);
      const intentId = body.intentId || body.id!;
      const proxied = await proxyRelayer("/quote", {
        method: "POST",
        body: JSON.stringify({ intentId, payer: body.payer ?? null }),
      });
      if (proxied.status >= 400) {
        const err = proxied.body as { error?: { code?: string; message?: string; details?: object } };
        throw new ApiError(
          (err.error?.code as never) || "RELAYER_UNAVAILABLE",
          err.error?.message || "Relayer quote failed",
          (err.error?.details as Record<string, unknown>) || {},
        );
      }
      return proxied.body;
    },
    "write",
  );
}
