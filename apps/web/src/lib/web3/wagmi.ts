"use client";

import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { whitechainSepolia as reownWhitechainSepolia } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { http } from "viem";
import { whitechainSepolia as localChain } from "@/lib/chain";
import { config } from "@/lib/config";

/**
 * Reown AppKit on Whitechain Sepolia (chain id 1874).
 * Verified against Whitechain docs: use `whitechainSepolia` from `@reown/appkit/networks`,
 * disable email/social (embedded wallets unsupported), prefer official RPC.
 *
 * NEXT_PUBLIC_REOWN_PROJECT_ID is required for the WalletConnect modal / AppKit session.
 * It is a public client id (not a server secret). Chain reads and API routes work without it.
 */
export const reownProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() || "";

const networks: [typeof reownWhitechainSepolia] = [reownWhitechainSepolia];

const metadata = {
  name: "WhiteFinance",
  description: "Business finance on Whitechain Sepolia",
  url: config.appUrl,
  icons: [`${config.appUrl}/favicon.ico`],
};

export const wagmiAdapter = new WagmiAdapter({
  projectId: reownProjectId || "00000000000000000000000000000000",
  networks,
  ssr: true,
  transports: {
    [reownWhitechainSepolia.id]: http(config.rpcUrl || localChain.rpcUrls.default.http[0]),
  },
});

let appKitInitialized = false;

export function ensureAppKit() {
  if (appKitInitialized || typeof window === "undefined") return;
  createAppKit({
    adapters: [wagmiAdapter],
    projectId: reownProjectId || "00000000000000000000000000000000",
    networks,
    metadata,
    features: {
      email: false,
      socials: false,
      analytics: false,
    },
    themeMode: "dark",
  });
  appKitInitialized = true;
}

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export { reownWhitechainSepolia };
