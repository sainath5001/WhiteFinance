export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTENT_NOT_FOUND"
  | "INVOICE_NOT_FOUND"
  | "FINANCING_NOT_FOUND"
  | "BUSINESS_NOT_FOUND"
  | "TX_NOT_FOUND"
  | "PAYMENT_UNVERIFIED"
  | "CHAIN_UNAVAILABLE"
  | "RATE_LIMITED"
  | "REORGED"
  | "RELAYER_UNAVAILABLE"
  | "RELAYER_PAUSED"
  | "AUTH_INVALID"
  | "AUTH_EXPIRED"
  | "AUTH_EARLY"
  | "AUTH_NONCE_USED"
  | "WRONG_CHAIN"
  | "WRONG_TOKEN"
  | "WRONG_RECIPIENT"
  | "WRONG_AMOUNT"
  | "INTENT_NOT_CREATED"
  | "INTENT_EXPIRED"
  | "PAYER_MISMATCH"
  | "PAYER_BLOCKED"
  | "INSUFFICIENT_USDT"
  | "MERCHANT_INACTIVE"
  | "AMOUNT_EXCEEDS_LIMIT"
  | "GAS_BUDGET_EXCEEDED"
  | "INSUFFICIENT_RELAYER_WBT"
  | "DOMAIN_MISMATCH"
  | "TX_FAILED"
  | "DUPLICATE_SUBMISSION"
  | "INTERNAL_ERROR";

const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTENT_NOT_FOUND: 404,
  INVOICE_NOT_FOUND: 404,
  FINANCING_NOT_FOUND: 404,
  BUSINESS_NOT_FOUND: 404,
  TX_NOT_FOUND: 404,
  PAYMENT_UNVERIFIED: 409,
  REORGED: 409,
  RATE_LIMITED: 429,
  CHAIN_UNAVAILABLE: 503,
  RELAYER_UNAVAILABLE: 503,
  RELAYER_PAUSED: 503,
  AUTH_INVALID: 400,
  AUTH_EXPIRED: 400,
  AUTH_EARLY: 400,
  AUTH_NONCE_USED: 409,
  WRONG_CHAIN: 400,
  WRONG_TOKEN: 400,
  WRONG_AMOUNT: 400,
  WRONG_RECIPIENT: 400,
  INTENT_NOT_CREATED: 409,
  INTENT_EXPIRED: 409,
  PAYER_MISMATCH: 400,
  PAYER_BLOCKED: 403,
  INSUFFICIENT_USDT: 400,
  MERCHANT_INACTIVE: 403,
  AMOUNT_EXCEEDS_LIMIT: 400,
  GAS_BUDGET_EXCEEDED: 503,
  INSUFFICIENT_RELAYER_WBT: 503,
  DOMAIN_MISMATCH: 503,
  TX_FAILED: 502,
  DUPLICATE_SUBMISSION: 409,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: ApiErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = statusByCode[code] ?? 400;
    this.details = details;
  }
}

export function toErrorBody(err: unknown) {
  if (err instanceof ApiError) {
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
        message: "Unexpected server error",
        details: {},
      },
    },
  };
}
