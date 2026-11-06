import { handle, options, parseJson } from "@/lib/http";
import { createIntentPreparedSchema } from "@/lib/schemas";
import { prepareCreateIntent } from "@/lib/services/payments";

export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request) {
  return handle(
    req,
    async () => {
      const body = await parseJson(req, createIntentPreparedSchema);
      return prepareCreateIntent(body);
    },
    "write",
  );
}
