import { ApiError } from "@/lib/errors";
import { handle, options, parseJson } from "@/lib/http";
import { refundPreparedSchema } from "@/lib/schemas";
import { prepareRefund } from "@/lib/services/payments";

export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request, ctx: { params: { intentId: string } }) {
  return handle(
    req,
    async () => {
      if (!/^\d+$/.test(ctx.params.intentId)) {
        throw new ApiError("VALIDATION_ERROR", "intentId must be an integer string");
      }
      const body = await parseJson(req, refundPreparedSchema);
      return prepareRefund(ctx.params.intentId, body.amountBase);
    },
    "write",
  );
}
