import type { Hex } from "viem";

export type IdemRecord = {
  key: string;
  intentId: string;
  txHash: Hex | null;
  status: "IN_FLIGHT" | "SUBMITTED" | "SUCCESS" | "FAILED";
  createdAt: number;
  result?: unknown;
};

const store = new Map<string, IdemRecord>();

export function getIdem(key: string): IdemRecord | null {
  const rec = store.get(key);
  if (!rec) return null;
  return rec;
}

export function putIdem(rec: IdemRecord, ttlMs: number) {
  store.set(rec.key, rec);
  setTimeout(() => {
    const cur = store.get(rec.key);
    if (cur && cur.createdAt === rec.createdAt) store.delete(rec.key);
  }, ttlMs).unref?.();
}

export function resetIdemForTests() {
  store.clear();
}

/** Stable key for a signed authorization so duplicate posts collapse. */
export function authFingerprint(intentId: string, nonce: Hex, from: string): string {
  return `auth:${intentId}:${from.toLowerCase()}:${nonce.toLowerCase()}`;
}
