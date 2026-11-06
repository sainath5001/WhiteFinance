import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import type { RelayerConfig } from "./config.js";
import { RelayerError, toErrorBody } from "./errors.js";
import { getHealth } from "./health.js";
import { getTxStatus } from "./budget.js";
import { logger } from "./logger.js";
import { buildQuote } from "./quote.js";
import { quoteSchema, submitSchema } from "./schemas.js";
import { submitSettlement } from "./submit.js";
import type { Hex } from "viem";

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new RelayerError("VALIDATION_ERROR", "Invalid JSON body");
  }
}

function clientIp(req: IncomingMessage): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) return xf.split(",")[0]!.trim();
  return req.socket.remoteAddress || "unknown";
}

function cors(cfg: RelayerConfig, req: IncomingMessage): Record<string, string> {
  const origin = req.headers.origin || "";
  const allowed =
    cfg.corsOrigins.includes("*") ||
    cfg.corsOrigins.includes(origin) ||
    (!origin && true);
  return {
    "Access-Control-Allow-Origin": allowed ? origin || cfg.corsOrigins[0] || "*" : "null",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Idempotency-Key, X-Relayer-Token, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function send(
  cfg: RelayerConfig,
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  body: unknown,
  extra: Record<string, string> = {},
) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...cors(cfg, req),
    ...extra,
  });
  res.end(payload);
}

function assertInternalAuth(cfg: RelayerConfig, req: IncomingMessage) {
  if (!cfg.internalToken) return; // open only if unset (local demo); production must set token
  const header = req.headers["x-relayer-token"];
  if (header !== cfg.internalToken) {
    throw new RelayerError("UNAUTHORIZED", "Invalid or missing X-Relayer-Token");
  }
}

export function startServer(cfg: RelayerConfig) {
  const server = createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url || "/", `http://${cfg.host}:${cfg.port}`);
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, cors(cfg, req));
        res.end();
        return;
      }

      if (req.method === "GET" && url.pathname === "/health") {
        const health = await getHealth(cfg);
        send(cfg, req, res, 200, health);
        return;
      }

      if (req.method === "GET" && url.pathname.startsWith("/tx/")) {
        const txHash = url.pathname.slice(4) as Hex;
        const rec = getTxStatus(txHash);
        send(cfg, req, res, 200, { txHash, record: rec });
        return;
      }

      if (req.method === "POST" && url.pathname === "/quote") {
        assertInternalAuth(cfg, req);
        const body = quoteSchema.parse(await readJson(req));
        const quote = await buildQuote({
          cfg,
          intentId: body.intentId,
          payer: body.payer,
        });
        send(cfg, req, res, 200, quote);
        return;
      }

      if (req.method === "POST" && url.pathname === "/submit") {
        assertInternalAuth(cfg, req);
        const body = submitSchema.parse(await readJson(req));
        const idemHeader =
          typeof req.headers["idempotency-key"] === "string"
            ? req.headers["idempotency-key"]
            : undefined;
        const result = await submitSettlement({
          cfg,
          intentId: body.intentId,
          idempotencyKey: body.idempotencyKey || idemHeader,
          ip: clientIp(req),
          auth: {
            from: body.authorization.from,
            to: body.authorization.to,
            value: BigInt(body.authorization.value),
            validAfter: BigInt(body.authorization.validAfter),
            validBefore: BigInt(body.authorization.validBefore),
            nonce: body.authorization.nonce,
            signature: body.authorization.signature,
          },
        });
        send(cfg, req, res, 200, result);
        return;
      }

      send(cfg, req, res, 404, {
        error: { code: "NOT_FOUND", message: "Unknown relayer route" },
      });
    } catch (err) {
      if (err instanceof ZodError) {
        send(cfg, req, res, 400, {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: {
              issues: err.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
              })),
            },
          },
        });
      } else {
        const mapped = toErrorBody(err);
        const extra: Record<string, string> = {};
        if (err instanceof RelayerError && err.code === "RATE_LIMITED") {
          extra["Retry-After"] = String(err.details.retryAfterSec ?? 1);
        }
        send(cfg, req, res, mapped.status, mapped.body, extra);
      }
      logger.warn("request_error", {
        path: url.pathname,
        method: req.method,
        durationMs: Date.now() - started,
        err: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    logger.info("request_ok", {
      path: url.pathname,
      method: req.method,
      durationMs: Date.now() - started,
    });
  });

  server.listen(cfg.port, cfg.host, () => {
    logger.info("relayer_listening", { host: cfg.host, port: cfg.port });
  });

  return server;
}
