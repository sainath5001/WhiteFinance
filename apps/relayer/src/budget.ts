import type { Hex } from "viem";

type DaySpend = { day: string; spentWei: bigint; txs: number };

let state: DaySpend = { day: utcDay(), spentWei: 0n, txs: 0 };

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function roll() {
  const d = utcDay();
  if (state.day !== d) {
    state = { day: d, spentWei: 0n, txs: 0 };
  }
}

export function getBudgetState() {
  roll();
  return { ...state, spentWei: state.spentWei.toString() };
}

export function remainingBudget(maxWbtPerDayWei: bigint): bigint {
  roll();
  return maxWbtPerDayWei > state.spentWei ? maxWbtPerDayWei - state.spentWei : 0n;
}

export function recordSpend(gasUsed: bigint, effectiveGasPrice: bigint) {
  roll();
  const cost = gasUsed * effectiveGasPrice;
  state.spentWei += cost;
  state.txs += 1;
  return cost;
}

export function resetBudgetForTests() {
  state = { day: utcDay(), spentWei: 0n, txs: 0 };
}

export type TxStatusRecord = {
  txHash: Hex;
  intentId: string;
  status: "SUBMITTED" | "SUCCESS" | "REVERTED" | "UNVERIFIED";
  updatedAt: number;
};

const txStatus = new Map<string, TxStatusRecord>();

export function setTxStatus(rec: TxStatusRecord) {
  txStatus.set(rec.txHash.toLowerCase(), rec);
  // Bound memory
  if (txStatus.size > 5_000) {
    const first = txStatus.keys().next().value;
    if (first) txStatus.delete(first);
  }
}

export function getTxStatus(txHash: Hex) {
  return txStatus.get(txHash.toLowerCase()) ?? null;
}
