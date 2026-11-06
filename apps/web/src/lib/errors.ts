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
    this.status = statusByCode[code];
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
