import { handle, options, parseJson } from "@/lib/http";
import { buyerRequestPreparedSchema } from "@/lib/schemas";
import { prepareBuyerRequest } from "@/lib/services/financing";

export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request) {
  return handle(
    req,
    async () => {
      const body = await parseJson(req, buyerRequestPreparedSchema);
      return {
        ...prepareBuyerRequest(body),
        note: "Buyer wallet broadcasts requestFinancing.",
      };
    },
    "write",
  );
}
