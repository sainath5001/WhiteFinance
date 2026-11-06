import { handle, options, parseQuery } from "@/lib/http";
import { merchantQuerySchema } from "@/lib/schemas";
import { listPaymentIntents } from "@/lib/services/payments";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request) {
  return handle(req, async () => {
    const q = parseQuery(req, merchantQuerySchema);
    return listPaymentIntents(q.merchant, q.limit);
  });
}
