import { handle, options, parseJson } from "@/lib/http";
import { sellerRequestPreparedSchema } from "@/lib/schemas";
import { prepareSellerRequest } from "@/lib/services/financing";

export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request) {
  return handle(
    req,
    async () => {
      const body = await parseJson(req, sellerRequestPreparedSchema);
      return {
        ...prepareSellerRequest(body),
        note: "Seller wallet broadcasts requestFinancing.",
      };
    },
    "write",
  );
}
