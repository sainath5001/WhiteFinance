import { ApiError } from "@/lib/errors";
import { handle, options } from "@/lib/http";
import { getInvoice } from "@/lib/services/invoices";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request, ctx: { params: { invoiceId: string } }) {
  return handle(req, async () => {
    if (!/^\d+$/.test(ctx.params.invoiceId)) {
      throw new ApiError("VALIDATION_ERROR", "invoiceId must be an integer string");
    }
    return getInvoice(ctx.params.invoiceId);
  });
}
