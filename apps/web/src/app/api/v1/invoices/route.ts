import { handle, options, parseQuery } from "@/lib/http";
import { sellerQuerySchema } from "@/lib/schemas";
import { listInvoices } from "@/lib/services/invoices";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request) {
  return handle(req, async () => {
    const q = parseQuery(req, sellerQuerySchema);
    if (!q.seller && !q.buyer) {
      return {
        count: 0,
        items: [],
        note: "Provide seller= or buyer= query parameter for a bounded event scan.",
      };
    }
    return listInvoices({ seller: q.seller, buyer: q.buyer, limit: q.limit });
  });
}
