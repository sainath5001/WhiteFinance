"use client";

import { useAccount } from "wagmi";
import { WalletArea } from "@/components/shared/wallet-area";
import { NetworkBanner } from "@/components/shared/network-banner";
import { config } from "@/lib/config";

export function WalletGate({
  children,
  title = "Connect a wallet",
  description = "This action requires a connected wallet on Whitechain Sepolia.",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const { isConnected, chainId } = useAccount();

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 flex justify-center">
          <WalletArea />
        </div>
      </div>
    );
  }

  if (chainId !== config.chainId) {
    return (
      <div className="space-y-3">
        <NetworkBanner />
        <p className="text-sm text-muted-foreground">
          Switch to Whitechain Sepolia before continuing.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
