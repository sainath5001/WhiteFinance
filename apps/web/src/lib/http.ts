import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { config } from "./config";
import { ApiError, toErrorBody } from "./errors";
import { logger } from "./logger";
import { clientIp, rateLimit } from "./rate-limit";

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") || "";
  const allowed =
    config.corsOrigins.includes("*") ||
    config.corsOrigins.includes(origin) ||
    (!origin && true);
  return {
    "Access-Control-Allow-Origin": allowed ? origin || config.corsOrigins[0] || "*" : "null",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(req: Request, data: unknown, init: ResponseInit = {}) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...corsHeaders(req),
      ...(init.headers || {}),
      "Cache-Control": "no-store",
    },
  });
}

export function options(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function parseJson<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Invalid JSON body");
  }
  try {
    return schema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ApiError("VALIDATION_ERROR", "Request validation failed", {
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    throw err;
  }
}

export function parseQuery<T>(req: Request, schema: ZodSchema<T>): T {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  try {
    return schema.parse(obj);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ApiError("VALIDATION_ERROR", "Query validation failed", {
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    throw err;
  }
}

export function enforceRateLimit(req: Request, kind: "read" | "write") {
  const ip = clientIp(req);
  const limit = kind === "read" ? config.rateLimitReadPerMin : config.rateLimitWritePerMin;
  const result = rateLimit(`${kind}:${ip}`, limit);
  if (!result.ok) {
    throw new ApiError("RATE_LIMITED", "Too many requests", {
      retryAfterSec: result.retryAfterSec,
    });
  }
  return result;
}

export function handle(req: Request, fn: () => Promise<unknown> | unknown, kind: "read" | "write" = "read") {
  return (async () => {
    const started = Date.now();
    try {
      const rl = enforceRateLimit(req, kind);
      const data = await fn();
      const res = json(req, data);
      res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
      logger.info("api_ok", {
        path: new URL(req.url).pathname,
        method: req.method,
        durationMs: Date.now() - started,
      });
      return res;
    } catch (err) {
      const mapped = toErrorBody(err);
      logger.warn("api_error", {
        path: new URL(req.url).pathname,
        method: req.method,
        code: mapped.body.error.code,
        durationMs: Date.now() - started,
      });
      const res = json(req, mapped.body, { status: mapped.status });
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        res.headers.set("Retry-After", String(err.details.retryAfterSec ?? 1));
      }
      return res;
    }
  })();
}
