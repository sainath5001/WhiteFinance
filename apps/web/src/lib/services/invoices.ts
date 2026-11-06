import type { Address, Hex } from "viem";
import { invoiceRegistryAbi } from "../abis";
import { getPublicClient, withRpcRetry } from "../blockchain/client";
import { scanContractEvents } from "../blockchain/scanner";
import { config } from "../config";
import { ApiError } from "../errors";
import { amountUsdt, invoiceStatusName } from "../format";
import {
  encodeConfirmInvoice,
  encodeCreateInvoice,
  hashDoc,
  stringToBytes32,
} from "./encode";
import { getBuyerFinancing, getSellerFinancing } from "./financing";

export async function getInvoice(invoiceId: string) {
  const client = getPublicClient();
  const id = BigInt(invoiceId);
  let inv: {
    seller: Address;
    buyer: Address;
    invoiceNumber: Hex;
    faceValue: bigint;
    dueDate: bigint;
    documentHash: Hex;
    termsHash: Hex;
    status: number;
    sellerFinancingId: bigint;
    buyerFinancingId: bigint;
    outstandingToSeller: bigint;
    remainderPaidToSeller: bigint;
    financedPaidToInvestor: bigint;
    investorReceivable: bigint;
  };
  try {
    inv = (await withRpcRetry("getInvoice", () =>
      client.readContract({
        address: config.contracts.invoiceRegistry,
        abi: invoiceRegistryAbi,
        functionName: "getInvoice",
        args: [id],
      }),
    )) as typeof inv;
  } catch {
    throw new ApiError("INVOICE_NOT_FOUND", `Invoice ${invoiceId} does not exist`);
  }

  const now = Math.floor(Date.now() / 1000);
  const status = invoiceStatusName(inv.status);
  const statusComputed =
    status === "Created" && now > Number(inv.dueDate)
      ? "Expired(computed)"
      : status;

  let sellerFinancing = null;
  let buyerFinancing = null;
  if (inv.sellerFinancingId !== 0n) {
    try {
      sellerFinancing = await getSellerFinancing(inv.sellerFinancingId.toString());
    } catch {
      sellerFinancing = { id: inv.sellerFinancingId.toString(), error: "unreadable" };
    }
  }
  if (inv.buyerFinancingId !== 0n) {
    try {
      buyerFinancing = await getBuyerFinancing(inv.buyerFinancingId.toString());
    } catch {
      buyerFinancing = { id: inv.buyerFinancingId.toString(), error: "unreadable" };
    }
  }

  return {
    invoiceId: id.toString(),
    seller: inv.seller,
    buyer: inv.buyer,
    invoiceNumber: inv.invoiceNumber,
    faceValueBase: inv.faceValue.toString(),
    faceValueUsdt: amountUsdt(inv.faceValue),
    dueDate: Number(inv.dueDate),
    documentHash: inv.documentHash,
    termsHash: inv.termsHash,
    status: status.toUpperCase(),
    statusComputed,
    authenticityNote:
      "documentHash is tamper evidence only. It does not prove the invoice is authentic.",
    outstandingToSellerBase: inv.outstandingToSeller.toString(),
    remainderPaidToSellerBase: inv.remainderPaidToSeller.toString(),
    financedPaidToInvestorBase: inv.financedPaidToInvestor.toString(),
    investorReceivableBase: inv.investorReceivable.toString(),
    sellerFinancingId: inv.sellerFinancingId === 0n ? null : inv.sellerFinancingId.toString(),
    buyerFinancingId: inv.buyerFinancingId === 0n ? null : inv.buyerFinancingId.toString(),
    sellerFinancing,
    buyerFinancing,
  };
}

export async function listInvoices(params: {
  seller?: Address;
  buyer?: Address;
  limit: number;
}) {
  const created = await scanContractEvents({
    address: config.contracts.invoiceRegistry,
    abi: invoiceRegistryAbi,
    eventName: "InvoiceCreated",
    args: {
      ...(params.seller ? { seller: params.seller } : {}),
      ...(params.buyer ? { buyer: params.buyer } : {}),
    },
    maxLogs: params.limit,
  });

  const items = [];
  for (const ev of created.slice(0, params.limit)) {
    const invoiceId = (ev.args.invoiceId as bigint).toString();
    try {
      items.push(await getInvoice(invoiceId));
    } catch {
      // skip
    }
  }
  return { count: items.length, items };
}

export function prepareCreateInvoice(input: {
  seller: Address;
  buyer: Address;
  invoiceNumber: string;
  faceValueBase: string;
  dueDate: number;
  documentHash: Hex;
  termsHash?: Hex;
}) {
  return {
    ...encodeCreateInvoice({
      buyer: input.buyer,
      invoiceNumber: input.invoiceNumber,
      faceValue: BigInt(input.faceValueBase),
      dueDate: BigInt(input.dueDate),
      documentHash: input.documentHash,
      termsHash: input.termsHash || hashDoc("demo-terms"),
    }),
    seller: input.seller,
    invoiceNumberBytes32: stringToBytes32(input.invoiceNumber),
    note: "Seller wallet broadcasts createInvoice. Hash is not authenticity.",
  };
}

export function prepareConfirmInvoice(invoiceId: string) {
  return encodeConfirmInvoice(BigInt(invoiceId));
}
