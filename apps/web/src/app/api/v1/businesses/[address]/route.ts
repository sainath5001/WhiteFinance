import { addressSchema } from "@/lib/schemas";
import { getBusiness } from "@/lib/services/business";
import { ApiError } from "@/lib/errors";
import { handle, options } from "@/lib/http";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request, ctx: { params: { address: string } }) {
  return handle(req, async () => {
    const parsed = addressSchema.safeParse(ctx.params.address);
    if (!parsed.success) throw new ApiError("VALIDATION_ERROR", "Invalid address");
    return getBusiness(parsed.data);
  });
}
