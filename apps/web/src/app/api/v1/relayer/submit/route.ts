import { ApiError } from "@/lib/errors";
import { handle, options } from "@/lib/http";

/** Relayer submit is intentionally unavailable in this backend pass. */
export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request) {
  return handle(
    req,
    async () => {
      throw new ApiError(
        "RELAYER_UNAVAILABLE",
        "Relayer worker is out of scope. Use gasful payIntent on PaymentProcessor.",
      );
    },
    "write",
  );
}
