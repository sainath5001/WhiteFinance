import { ApiError } from "@/lib/errors";
import { handle, options } from "@/lib/http";
import { prepareConfirmInvoice } from "@/lib/services/invoices";

export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request, ctx: { params: { invoiceId: string } }) {
  return handle(
    req,
    async () => {
      if (!/^\d+$/.test(ctx.params.invoiceId)) {
        throw new ApiError("VALIDATION_ERROR", "invoiceId must be an integer string");
      }
      return {
        ...prepareConfirmInvoice(ctx.params.invoiceId),
        note: "Buyer wallet must broadcast confirmInvoice.",
      };
    },
    "write",
  );
}
