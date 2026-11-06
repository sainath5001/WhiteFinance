import { ApiError } from "@/lib/errors";
import { handle, options } from "@/lib/http";
import { getPaymentIntent } from "@/lib/services/payments";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request, ctx: { params: { intentId: string } }) {
  return handle(req, async () => {
    if (!/^\d+$/.test(ctx.params.intentId)) {
      throw new ApiError("VALIDATION_ERROR", "intentId must be an integer string");
    }
    return getPaymentIntent(ctx.params.intentId);
  });
}
