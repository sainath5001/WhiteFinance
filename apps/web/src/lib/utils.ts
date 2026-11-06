import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function abbreviateAddress(address: string, size = 4) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}

export function formatUsdt(amount: string | number, decimals = 2) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return "—";
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} USDT`;
}
