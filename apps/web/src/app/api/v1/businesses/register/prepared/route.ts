import { handle, options, parseJson } from "@/lib/http";
import { registerPreparedSchema } from "@/lib/schemas";
import { prepareRegister } from "@/lib/services/business";

export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request) {
  return handle(
    req,
    async () => {
      const body = await parseJson(req, registerPreparedSchema);
      return prepareRegister(body);
    },
    "write",
  );
}
