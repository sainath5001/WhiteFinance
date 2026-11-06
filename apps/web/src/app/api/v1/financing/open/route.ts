import { handle, options, parseQuery } from "@/lib/http";
import { listQuerySchema } from "@/lib/schemas";
import { listOpenFinancing } from "@/lib/services/financing";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request) {
  return handle(req, async () => {
    const q = parseQuery(req, listQuerySchema);
    return listOpenFinancing(q.limit);
  });
}
