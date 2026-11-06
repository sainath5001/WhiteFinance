export type RelayerErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "AUTH_INVALID"
  | "AUTH_EXPIRED"
  | "AUTH_EARLY"
  | "AUTH_NONCE_USED"
  | "WRONG_CHAIN"
  | "WRONG_TOKEN"
  | "WRONG_RECIPIENT"
  | "WRONG_AMOUNT"
  | "INTENT_NOT_FOUND"
  | "INTENT_NOT_CREATED"
  | "INTENT_EXPIRED"
  | "PAYER_MISMATCH"
  | "PAYER_BLOCKED"
  | "INSUFFICIENT_USDT"
  | "MERCHANT_INACTIVE"
  | "AMOUNT_EXCEEDS_LIMIT"
  | "RATE_LIMITED"
  | "RELAYER_PAUSED"
  | "GAS_BUDGET_EXCEEDED"
  | "INSUFFICIENT_RELAYER_WBT"
  | "DOMAIN_MISMATCH"
  | "TX_FAILED"
  | "PAYMENT_UNVERIFIED"
  | "DUPLICATE_SUBMISSION"
  | "CHAIN_UNAVAILABLE"
  | "INTERNAL_ERROR";

const statusByCode: Record<RelayerErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  AUTH_INVALID: 400,
  AUTH_EXPIRED: 400,
  AUTH_EARLY: 400,
  AUTH_NONCE_USED: 409,
  WRONG_CHAIN: 400,
  WRONG_TOKEN: 400,
  WRONG_RECIPIENT: 400,
  WRONG_AMOUNT: 400,
  INTENT_NOT_FOUND: 404,
  INTENT_NOT_CREATED: 409,
  INTENT_EXPIRED: 409,
  PAYER_MISMATCH: 400,
  PAYER_BLOCKED: 403,
  INSUFFICIENT_USDT: 400,
  MERCHANT_INACTIVE: 403,
  AMOUNT_EXCEEDS_LIMIT: 400,
  RATE_LIMITED: 429,
  RELAYER_PAUSED: 503,
  GAS_BUDGET_EXCEEDED: 503,
  INSUFFICIENT_RELAYER_WBT: 503,
  DOMAIN_MISMATCH: 503,
  TX_FAILED: 502,
  PAYMENT_UNVERIFIED: 409,
  DUPLICATE_SUBMISSION: 409,
  CHAIN_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export class RelayerError extends Error {
  readonly code: RelayerErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: RelayerErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "RelayerError";
    this.code = code;
    this.status = statusByCode[code];
    this.details = details;
  }
}

export function toErrorBody(err: unknown) {
  if (err instanceof RelayerError) {
    return {
      status: err.status,
      body: {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR" as const,
        message: "Unexpected relayer error",
        details: {},
      },
    },
  };
}
