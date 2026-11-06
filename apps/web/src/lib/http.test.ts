import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJson, parseQuery } from "./http";
import { ApiError } from "./errors";

describe("HTTP helpers", () => {
  it("parses valid JSON with Zod", async () => {
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ amountBase: "1" }),
      headers: { "content-type": "application/json" },
    });
    const schema = z.object({ amountBase: z.string() });
    await expect(parseJson(req, schema)).resolves.toEqual({ amountBase: "1" });
  });

  it("rejects invalid JSON bodies", async () => {
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: "{bad",
      headers: { "content-type": "application/json" },
    });
    await expect(parseJson(req, z.object({}))).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects schema failures", async () => {
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ amountBase: 1 }),
      headers: { "content-type": "application/json" },
    });
    await expect(
      parseJson(req, z.object({ amountBase: z.string() })),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("parses query params", () => {
    const req = new Request("http://localhost/api?limit=5");
    const q = parseQuery(req, z.object({ limit: z.coerce.number() }));
    expect(q.limit).toBe(5);
  });
});
