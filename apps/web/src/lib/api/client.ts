import { config } from "@/lib/config";

const apiBase = () =>
  (process.env.NEXT_PUBLIC_WF_API_BASE || config.appUrl || "").replace(/\/$/, "");

export class ApiClientError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  return parse(res);
}

export async function apiPost<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return parse(res);
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: Record<string, unknown> } })
      .error;
    throw new ApiClientError(
      res.status,
      err?.code || "BACKEND_ERROR",
      err?.message || `Request failed (${res.status})`,
      err?.details || {},
    );
  }
  return data as T;
}

export type PaymentIntentDto = {
  intentId: string;
  merchant: string;
  payoutAddress: string;
  merchantName: string | null;
  orderRef: string;
  amountBase: string;
  amountUsdt: string;
  token: string;
  payer: string | null;
  payerSettled: string | null;
  expiresAt: number;
  status: string;
  statusRaw: number;
  paidAmountBase: string;
  refundedAmountBase: string;
  settledBlock: string | null;
  confirmationStage: "soft" | "safe" | "finalized" | null;
  reorged?: boolean;
  txHash?: string | null;
  explorerUrl?: string | null;
  checkoutUrl?: string;
};

export type RelayerQuoteDto = {
  available: boolean;
  pauseReason: string | null;
  intentId: string;
  amountBase: string;
  token: string;
  paymentProcessor: string;
  typedData?: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, string>;
  };
  authorizationTemplate?: {
    from: string;
    to: string;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: string;
  };
  plainLanguage?: Record<string, string>;
};

export type RelayerSubmitDto = {
  status: string;
  txHash: string | null;
  intentId: string;
  duplicate?: boolean;
  confirmationStage?: string;
  explorerUrl?: string;
};

export type InvoiceDto = {
  invoiceId: string;
  seller: string;
  buyer: string;
  invoiceNumber: string;
  faceValueBase: string;
  faceValueUsdt: string;
  dueDate: number;
  documentHash: string;
  termsHash: string;
  status: string;
  statusComputed?: string;
  authenticityNote?: string;
  outstandingToSellerBase: string;
  remainderPaidToSellerBase: string;
  financedPaidToInvestorBase: string;
  investorReceivableBase: string;
  sellerFinancingId: string | null;
  buyerFinancingId: string | null;
  sellerFinancing?: SellerFinancingDto | { id: string; error: string } | null;
  buyerFinancing?: BuyerFinancingDto | { id: string; error: string } | null;
};

export type SellerFinancingDto = {
  type: "seller";
  financingId: string;
  invoiceId: string;
  seller: string;
  buyer: string;
  investor: string | null;
  faceValueBase: string;
  faceValueUsdt: string;
  advanceAmountBase: string;
  discountAmountBase: string;
  dueDate: number;
  fundingDeadline: number;
  gracePeriod: number;
  status: string;
  statusComputed?: string;
  repaid: boolean;
  accounting: {
    sellerReceivesOnFund: string;
    investorReceivesOnRepay: string;
    investorProfitIfRepaid: string;
  };
};

export type BuyerFinancingDto = {
  type: "buyer";
  financingId: string;
  invoiceId: string;
  seller: string;
  buyer: string;
  investor: string | null;
  faceValueBase: string;
  principalBase: string;
  feeBase: string;
  sellerRemainderBase: string;
  dueDate: number;
  fundingDeadline: number;
  gracePeriod: number;
  status: string;
  statusComputed?: string;
  investorRepaid: boolean;
  remainderPaid: boolean;
  accounting: {
    note: string;
    sellerReceivesOnFund: string;
    sellerStillOwed: string;
    investorReceivable: string;
    invariant: string;
  };
};

export type OpenFinancingDto = {
  seller: SellerFinancingDto[];
  buyer: BuyerFinancingDto[];
};
