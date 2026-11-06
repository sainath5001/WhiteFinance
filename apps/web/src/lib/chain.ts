import { defineChain } from "viem";
import { config } from "./config";

export const whitechainSepolia = defineChain({
  id: config.chainId,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 },
  rpcUrls: {
    default: { http: [config.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Whitechain Explorer", url: config.explorerUrl },
  },
  testnet: true,
});
