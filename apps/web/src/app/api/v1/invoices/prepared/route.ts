import { handle, options, parseJson } from "@/lib/http";
import { createInvoicePreparedSchema } from "@/lib/schemas";
import { prepareCreateInvoice } from "@/lib/services/invoices";

export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request) {
  return handle(
    req,
    async () => {
      const body = await parseJson(req, createInvoicePreparedSchema);
      return prepareCreateInvoice(body);
    },
    "write",
  );
}
