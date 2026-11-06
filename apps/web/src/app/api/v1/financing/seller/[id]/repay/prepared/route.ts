import { ApiError } from "@/lib/errors";
import { handle, options } from "@/lib/http";
import { prepareSellerRepay } from "@/lib/services/financing";

export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request, ctx: { params: { id: string } }) {
  return handle(
    req,
    async () => {
      if (!/^\d+$/.test(ctx.params.id)) {
        throw new ApiError("VALIDATION_ERROR", "financing id must be an integer string");
      }
      return {
        ...prepareSellerRepay(ctx.params.id),
        note: "Buyer/seller wallet broadcasts repay after approving USDT.",
      };
    },
    "write",
  );
}
