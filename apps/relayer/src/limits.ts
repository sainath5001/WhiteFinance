type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** In-memory rate limiter. Not durable across restarts or instances. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
  }
  if (current.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, limit - current.count),
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function resetRateLimitsForTests() {
  buckets.clear();
}

export function enforceSubmitLimits(params: {
  ip: string;
  payer: string;
  merchant: string;
  globalPerMin: number;
  payerPerMin: number;
  ipPerMin: number;
  merchantPerMin: number;
}) {
  const checks = [
    rateLimit("global", params.globalPerMin),
    rateLimit(`payer:${params.payer.toLowerCase()}`, params.payerPerMin),
    rateLimit(`merchant:${params.merchant.toLowerCase()}`, params.merchantPerMin),
    rateLimit(`ip:${params.ip}`, params.ipPerMin),
  ];
  for (const c of checks) {
    if (!c.ok) return c;
  }
  return { ok: true as const, remaining: Math.min(...checks.map((c) => c.remaining)), retryAfterSec: 60 };
}
