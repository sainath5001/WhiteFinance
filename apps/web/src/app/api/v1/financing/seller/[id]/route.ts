import { ApiError } from "@/lib/errors";
import { handle, options } from "@/lib/http";
import { getSellerFinancing } from "@/lib/services/financing";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request, ctx: { params: { id: string } }) {
  return handle(req, async () => {
    if (!/^\d+$/.test(ctx.params.id)) {
      throw new ApiError("VALIDATION_ERROR", "financing id must be an integer string");
    }
    return getSellerFinancing(ctx.params.id);
  });
}
