import { handle, options, parseJson } from "@/lib/http";
import { verifyPaymentSchema } from "@/lib/schemas";
import { verifyClaimedPayment } from "@/lib/services/payments";

export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request) {
  return handle(
    req,
    async () => {
      const body = await parseJson(req, verifyPaymentSchema);
      return verifyClaimedPayment(body.txHash, body.intentId);
    },
    "write",
  );
}
