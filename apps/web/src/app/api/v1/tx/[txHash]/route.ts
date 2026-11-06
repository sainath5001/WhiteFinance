import { ApiError } from "@/lib/errors";
import { handle, options } from "@/lib/http";
import { hexSchema } from "@/lib/schemas";
import { getTransactionStatus } from "@/lib/services/tx";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request, ctx: { params: { txHash: string } }) {
  return handle(req, async () => {
    const parsed = hexSchema.safeParse(ctx.params.txHash);
    if (!parsed.success || parsed.data.length !== 66) {
      throw new ApiError("VALIDATION_ERROR", "txHash must be a 32-byte hex string");
    }
    return getTransactionStatus(parsed.data);
  });
}
