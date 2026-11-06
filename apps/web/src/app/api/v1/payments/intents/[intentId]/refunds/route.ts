import { ApiError } from "@/lib/errors";
import { handle, options } from "@/lib/http";
import { getPaymentReceipt } from "@/lib/services/payments";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request, ctx: { params: { intentId: string } }) {
  return handle(req, async () => {
    if (!/^\d+$/.test(ctx.params.intentId)) {
      throw new ApiError("VALIDATION_ERROR", "intentId must be an integer string");
    }
    const receipt = await getPaymentReceipt(ctx.params.intentId);
    return {
      intentId: receipt.intentId,
      status: receipt.status,
      paidAmountBase: receipt.paidAmountBase,
      refundedAmountBase: receipt.refundedAmountBase,
      remainingRefundableBase: (
        BigInt(receipt.paidAmountBase) - BigInt(receipt.refundedAmountBase)
      ).toString(),
      events: receipt.events.refunded,
      note: "Refund status is derived from onchain PaymentProcessor state and events.",
    };
  });
}
