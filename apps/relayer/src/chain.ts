import { defineChain } from "viem";
import type { RelayerConfig } from "./config.js";

export function whitechainSepolia(cfg: RelayerConfig) {
  return defineChain({
    id: cfg.chainId,
    name: "Whitechain Sepolia",
    nativeCurrency: { name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 },
    rpcUrls: {
      default: { http: [cfg.rpcUrl] },
    },
    blockExplorers: {
      default: { name: "Whitechain Explorer", url: cfg.explorerUrl },
    },
    testnet: true,
  });
}
