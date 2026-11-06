import { formatUnits, type Address, type Hex } from "viem";
import { config, explorerTx } from "./config";

export const IntentStatus = [
  "None",
  "Created",
  "Settled",
  "PartiallyRefunded",
  "Refunded",
  "Expired",
  "Cancelled",
] as const;

export const InvoiceStatus = [
  "None",
  "Created",
  "BuyerConfirmed",
  "Cancelled",
  "Settled",
  "Expired",
] as const;

export const FinancingStatus = [
  "None",
  "Requested",
  "Active",
  "Repaid",
  "Overdue",
  "Defaulted",
  "Disputed",
  "Cancelled",
  "Expired",
] as const;

export function intentStatusName(v: number | bigint): string {
  const i = Number(v);
  return IntentStatus[i] ?? `Unknown(${i})`;
}

export function invoiceStatusName(v: number | bigint): string {
  const i = Number(v);
  return InvoiceStatus[i] ?? `Unknown(${i})`;
}

export function financingStatusName(v: number | bigint): string {
  const i = Number(v);
  return FinancingStatus[i] ?? `Unknown(${i})`;
}

export function amountUsdt(base: bigint | string): string {
  return formatUnits(BigInt(base), config.usdtDecimals);
}

export function bytes32ToOrderRef(value: Hex): string {
  // Prefer UTF-8 printable decode; fall back to hex.
  const hex = value.slice(2);
  let out = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = Number.parseInt(hex.slice(i, i + 2), 16);
    if (code === 0) break;
    if (code >= 32 && code <= 126) out += String.fromCharCode(code);
    else return value;
  }
  return out || value;
}

export function checkoutUrl(intentId: string): string {
  return `${config.appUrl}/pay/${intentId}`;
}

export function txMeta(txHash: Hex | null | undefined) {
  if (!txHash) return { txHash: null, explorerUrl: null };
  return { txHash, explorerUrl: explorerTx(txHash) };
}

export function nullAddress(a: Address): Address | null {
  return a === "0x0000000000000000000000000000000000000000" ? null : a;
}
