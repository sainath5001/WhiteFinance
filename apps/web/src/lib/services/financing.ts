import type { Address } from "viem";
import { buyerFinancingAbi, sellerFinancingAbi } from "../abis";
import { getPublicClient, withRpcRetry } from "../blockchain/client";
import { scanContractEvents } from "../blockchain/scanner";
import { config } from "../config";
import { ApiError } from "../errors";
import { amountUsdt, financingStatusName } from "../format";
import {
  encodeBuyerFund,
  encodeBuyerRepay,
  encodeBuyerRequest,
  encodePayRemainder,
  encodeSellerFund,
  encodeSellerRepay,
  encodeSellerRequest,
} from "./encode";

function computedFinancingStatus(status: string, dueDate: number, repaid: boolean) {
  if (repaid || status === "Repaid") return status;
  const now = Math.floor(Date.now() / 1000);
  if ((status === "Active" || status === "Requested") && now > dueDate) {
    return `${status}->Overdue(computed)`;
  }
  return status;
}

export async function getSellerFinancing(id: string) {
  const client = getPublicClient();
  let p: {
    invoiceId: bigint;
    seller: Address;
    buyer: Address;
    investor: Address;
    faceValue: bigint;
    advanceAmount: bigint;
    discountAmount: bigint;
    dueDate: bigint;
    fundingDeadline: bigint;
    gracePeriod: bigint;
    status: number;
    statusBeforeDispute: number;
    repaid: boolean;
  };
  try {
    p = (await withRpcRetry("getSellerPosition", () =>
      client.readContract({
        address: config.contracts.sellerFinancing,
        abi: sellerFinancingAbi,
        functionName: "getPosition",
        args: [BigInt(id)],
      }),
    )) as typeof p;
  } catch {
    throw new ApiError("FINANCING_NOT_FOUND", `Seller financing ${id} not found`);
  }

  const status = financingStatusName(p.status);
  return {
    type: "seller" as const,
    financingId: id,
    invoiceId: p.invoiceId.toString(),
    seller: p.seller,
    buyer: p.buyer,
    investor: p.investor === "0x0000000000000000000000000000000000000000" ? null : p.investor,
    faceValueBase: p.faceValue.toString(),
    faceValueUsdt: amountUsdt(p.faceValue),
    advanceAmountBase: p.advanceAmount.toString(),
    discountAmountBase: p.discountAmount.toString(),
    dueDate: Number(p.dueDate),
    fundingDeadline: Number(p.fundingDeadline),
    gracePeriod: Number(p.gracePeriod),
    status: status.toUpperCase(),
    statusComputed: computedFinancingStatus(status, Number(p.dueDate), p.repaid),
    repaid: p.repaid,
    accounting: {
      sellerReceivesOnFund: amountUsdt(p.advanceAmount),
      investorReceivesOnRepay: amountUsdt(p.faceValue),
      investorProfitIfRepaid: amountUsdt(p.discountAmount),
    },
  };
}

export async function getBuyerFinancing(id: string) {
  const client = getPublicClient();
  let p: {
    invoiceId: bigint;
    seller: Address;
    buyer: Address;
    investor: Address;
    faceValue: bigint;
    principal: bigint;
    fee: bigint;
    sellerRemainder: bigint;
    dueDate: bigint;
    fundingDeadline: bigint;
    gracePeriod: bigint;
    status: number;
    statusBeforeDispute: number;
    investorRepaid: boolean;
    remainderPaid: boolean;
  };
  try {
    p = (await withRpcRetry("getBuyerPosition", () =>
      client.readContract({
        address: config.contracts.buyerFinancing,
        abi: buyerFinancingAbi,
        functionName: "getPosition",
        args: [BigInt(id)],
      }),
    )) as typeof p;
  } catch {
    throw new ApiError("FINANCING_NOT_FOUND", `Buyer financing ${id} not found`);
  }

  const status = financingStatusName(p.status);
  return {
    type: "buyer" as const,
    financingId: id,
    invoiceId: p.invoiceId.toString(),
    seller: p.seller,
    buyer: p.buyer,
    investor: p.investor === "0x0000000000000000000000000000000000000000" ? null : p.investor,
    faceValueBase: p.faceValue.toString(),
    principalBase: p.principal.toString(),
    feeBase: p.fee.toString(),
    sellerRemainderBase: p.sellerRemainder.toString(),
    dueDate: Number(p.dueDate),
    fundingDeadline: Number(p.fundingDeadline),
    gracePeriod: Number(p.gracePeriod),
    status: status.toUpperCase(),
    statusComputed: computedFinancingStatus(status, Number(p.dueDate), p.investorRepaid),
    investorRepaid: p.investorRepaid,
    remainderPaid: p.remainderPaid,
    accounting: {
      note: "Principal paid to seller extinguishes that slice. Never double-count principal as still owed to seller.",
      sellerReceivesOnFund: amountUsdt(p.principal),
      sellerStillOwed: amountUsdt(p.sellerRemainder),
      investorReceivable: amountUsdt(p.principal + p.fee),
      invariant: `${p.principal} + ${p.sellerRemainder} == ${p.faceValue}`,
    },
  };
}

export async function listOpenFinancing(limit = 20) {
  const sellerOpen = await scanContractEvents({
    address: config.contracts.sellerFinancing,
    abi: sellerFinancingAbi,
    eventName: "FinancingRequested",
    maxLogs: limit,
  });
  const buyerOpen = await scanContractEvents({
    address: config.contracts.buyerFinancing,
    abi: buyerFinancingAbi,
    eventName: "FinancingRequested",
    maxLogs: limit,
  });

  const sellerItems = [];
  for (const ev of sellerOpen) {
    const id = (ev.args.financingId as bigint).toString();
    try {
      const pos = await getSellerFinancing(id);
      if (pos.status === "REQUESTED") sellerItems.push(pos);
    } catch {
      // skip
    }
  }
  const buyerItems = [];
  for (const ev of buyerOpen) {
    const id = (ev.args.financingId as bigint).toString();
    try {
      const pos = await getBuyerFinancing(id);
      if (pos.status === "REQUESTED") buyerItems.push(pos);
    } catch {
      // skip
    }
  }

  return {
    seller: sellerItems.slice(0, limit),
    buyer: buyerItems.slice(0, limit),
  };
}

export async function listInvestorHistory(investor: Address, limit = 20) {
  const sellerFunded = await scanContractEvents({
    address: config.contracts.sellerFinancing,
    abi: sellerFinancingAbi,
    eventName: "FinancingFunded",
    args: { investor },
    maxLogs: limit,
  });
  const buyerFunded = await scanContractEvents({
    address: config.contracts.buyerFinancing,
    abi: buyerFinancingAbi,
    eventName: "FinancingFunded",
    args: { investor },
    maxLogs: limit,
  });

  const items = [];
  for (const ev of sellerFunded) {
    const id = (ev.args.financingId as bigint).toString();
    try {
      items.push(await getSellerFinancing(id));
    } catch {
      // skip
    }
  }
  for (const ev of buyerFunded) {
    const id = (ev.args.financingId as bigint).toString();
    try {
      items.push(await getBuyerFinancing(id));
    } catch {
      // skip
    }
  }
  return { investor, count: items.length, items: items.slice(0, limit) };
}

export function prepareSellerRequest(input: {
  invoiceId: string;
  advanceAmount: string;
  discountAmount: string;
  fundingDeadline: number;
}) {
  return encodeSellerRequest({
    invoiceId: BigInt(input.invoiceId),
    advanceAmount: BigInt(input.advanceAmount),
    discountAmount: BigInt(input.discountAmount),
    fundingDeadline: BigInt(input.fundingDeadline),
  });
}

export function prepareSellerFund(id: string) {
  return encodeSellerFund(BigInt(id));
}

export function prepareSellerRepay(id: string) {
  return encodeSellerRepay(BigInt(id));
}

export function prepareBuyerRequest(input: {
  invoiceId: string;
  principal: string;
  fee: string;
  fundingDeadline: number;
}) {
  return encodeBuyerRequest({
    invoiceId: BigInt(input.invoiceId),
    principal: BigInt(input.principal),
    fee: BigInt(input.fee),
    fundingDeadline: BigInt(input.fundingDeadline),
  });
}

export function prepareBuyerFund(id: string) {
  return encodeBuyerFund(BigInt(id));
}

export function prepareBuyerRepay(id: string) {
  return encodeBuyerRepay(BigInt(id));
}

export function preparePayRemainder(id: string) {
  return encodePayRemainder(BigInt(id));
}
