import { describe, expect, it } from "vitest";
import { ApiError, toErrorBody } from "./errors";

describe("API errors", () => {
  it("maps codes to safe HTTP statuses", () => {
    expect(new ApiError("VALIDATION_ERROR", "bad").status).toBe(400);
    expect(new ApiError("INTENT_NOT_FOUND", "x").status).toBe(404);
    expect(new ApiError("REORGED", "x").status).toBe(409);
    expect(new ApiError("RATE_LIMITED", "x").status).toBe(429);
    expect(new ApiError("CHAIN_UNAVAILABLE", "x").status).toBe(503);
  });

  it("hides unexpected error details", () => {
    const body = toErrorBody(new Error("secret stack"));
    expect(body.status).toBe(500);
    expect(body.body.error.message).toBe("Unexpected server error");
    expect(JSON.stringify(body)).not.toContain("secret stack");
  });
});
