/**
 * Stub for `@wagmi/core/tempo` imported by newer `@wagmi/connectors`.
 * WhiteFinance does not use Tempo; AppKit on Whitechain uses external wallets only.
 */
export function tempoWallet(): never {
  throw new Error("Tempo wallet connector is not supported on WhiteFinance / Whitechain Sepolia.");
}
