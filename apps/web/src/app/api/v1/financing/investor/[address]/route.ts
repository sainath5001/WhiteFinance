import { addressSchema, listQuerySchema } from "@/lib/schemas";
import { ApiError } from "@/lib/errors";
import { handle, options, parseQuery } from "@/lib/http";
import { listInvestorHistory } from "@/lib/services/financing";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request, ctx: { params: { address: string } }) {
  return handle(req, async () => {
    const parsed = addressSchema.safeParse(ctx.params.address);
    if (!parsed.success) throw new ApiError("VALIDATION_ERROR", "Invalid address");
    const q = parseQuery(req, listQuerySchema);
    return listInvestorHistory(parsed.data, q.limit);
  });
}
