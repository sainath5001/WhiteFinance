import { formatUnits, parseUnits } from "viem";
import { config } from "@/lib/config";

export function usdtToBase(amountUsdt: string): bigint {
  return parseUnits(amountUsdt, config.usdtDecimals);
}

export function baseToUsdt(amountBase: bigint | string): string {
  const v = typeof amountBase === "string" ? BigInt(amountBase) : amountBase;
  return formatUnits(v, config.usdtDecimals);
}

export function displayUsdt(amountBase: bigint | string, maxFrac = 6): string {
  const n = Number(baseToUsdt(amountBase));
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  })} USDT`;
}

/** BusinessRegistry role bitmask bits used by WhiteFinance. */
export const ROLE_BITS = {
  MERCHANT: 1,
  SELLER: 2,
  BUYER: 4,
  INVESTOR: 8,
} as const;
