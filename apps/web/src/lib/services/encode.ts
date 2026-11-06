import {
  type Address,
  type Hex,
  encodeFunctionData,
  keccak256,
  stringToBytes,
  toBytes,
  pad,
  toHex,
} from "viem";
import {
  businessRegistryAbi,
  buyerFinancingAbi,
  invoiceRegistryAbi,
  paymentProcessorAbi,
  sellerFinancingAbi,
} from "../abis";
import { config } from "../config";

export function stringToBytes32(input: string): Hex {
  const bytes = stringToBytes(input);
  if (bytes.length > 32) {
    return keccak256(bytes);
  }
  return pad(toHex(bytes), { size: 32 });
}

export function preparedTx(to: Address, data: Hex) {
  return { to, data, value: "0" as const };
}

export function encodeRegister(params: {
  displayName: string;
  roles: number;
  payoutAddress: Address;
  webhookUrl: string;
}) {
  return preparedTx(
    config.contracts.businessRegistry,
    encodeFunctionData({
      abi: businessRegistryAbi,
      functionName: "register",
      args: [params.displayName, params.roles, params.payoutAddress, params.webhookUrl],
    }),
  );
}

export function encodeCreateIntent(params: {
  orderRef: string;
  amount: bigint;
  payer: Address;
  expiresAt: bigint;
}) {
  return preparedTx(
    config.contracts.paymentProcessor,
    encodeFunctionData({
      abi: paymentProcessorAbi,
      functionName: "createIntent",
      args: [stringToBytes32(params.orderRef), params.amount, params.payer, params.expiresAt],
    }),
  );
}

export function encodeRefund(intentId: bigint, amount: bigint) {
  return preparedTx(
    config.contracts.paymentProcessor,
    encodeFunctionData({
      abi: paymentProcessorAbi,
      functionName: "refund",
      args: [intentId, amount],
    }),
  );
}

export function encodeCreateInvoice(params: {
  buyer: Address;
  invoiceNumber: string;
  faceValue: bigint;
  dueDate: bigint;
  documentHash: Hex;
  termsHash: Hex;
}) {
  return preparedTx(
    config.contracts.invoiceRegistry,
    encodeFunctionData({
      abi: invoiceRegistryAbi,
      functionName: "createInvoice",
      args: [
        params.buyer,
        stringToBytes32(params.invoiceNumber),
        params.faceValue,
        params.dueDate,
        params.documentHash,
        params.termsHash,
      ],
    }),
  );
}

export function encodeConfirmInvoice(invoiceId: bigint) {
  return preparedTx(
    config.contracts.invoiceRegistry,
    encodeFunctionData({
      abi: invoiceRegistryAbi,
      functionName: "confirmInvoice",
      args: [invoiceId],
    }),
  );
}

export function encodeSellerRequest(params: {
  invoiceId: bigint;
  advanceAmount: bigint;
  discountAmount: bigint;
  fundingDeadline: bigint;
}) {
  return preparedTx(
    config.contracts.sellerFinancing,
    encodeFunctionData({
      abi: sellerFinancingAbi,
      functionName: "requestFinancing",
      args: [params.invoiceId, params.advanceAmount, params.discountAmount, params.fundingDeadline],
    }),
  );
}

export function encodeSellerFund(financingId: bigint) {
  return preparedTx(
    config.contracts.sellerFinancing,
    encodeFunctionData({
      abi: sellerFinancingAbi,
      functionName: "fund",
      args: [financingId],
    }),
  );
}

export function encodeSellerRepay(financingId: bigint) {
  return preparedTx(
    config.contracts.sellerFinancing,
    encodeFunctionData({
      abi: sellerFinancingAbi,
      functionName: "repay",
      args: [financingId],
    }),
  );
}

export function encodeBuyerRequest(params: {
  invoiceId: bigint;
  principal: bigint;
  fee: bigint;
  fundingDeadline: bigint;
}) {
  return preparedTx(
    config.contracts.buyerFinancing,
    encodeFunctionData({
      abi: buyerFinancingAbi,
      functionName: "requestFinancing",
      args: [params.invoiceId, params.principal, params.fee, params.fundingDeadline],
    }),
  );
}

export function encodeBuyerFund(financingId: bigint) {
  return preparedTx(
    config.contracts.buyerFinancing,
    encodeFunctionData({
      abi: buyerFinancingAbi,
      functionName: "fund",
      args: [financingId],
    }),
  );
}

export function encodeBuyerRepay(financingId: bigint) {
  return preparedTx(
    config.contracts.buyerFinancing,
    encodeFunctionData({
      abi: buyerFinancingAbi,
      functionName: "repay",
      args: [financingId],
    }),
  );
}

export function encodePayRemainder(financingId: bigint) {
  return preparedTx(
    config.contracts.buyerFinancing,
    encodeFunctionData({
      abi: buyerFinancingAbi,
      functionName: "payRemainder",
      args: [financingId],
    }),
  );
}

export function zeroAddress(): Address {
  return "0x0000000000000000000000000000000000000000";
}

export function hashDoc(content: string): Hex {
  return keccak256(toBytes(content));
}
