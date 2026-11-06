"use client";

import { useAppKit } from "@reown/appkit/react";
import { formatUnits } from "viem";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { abbreviateAddress } from "@/lib/utils";
import { config } from "@/lib/config";
import { contracts } from "@/lib/web3/contracts";
import { reownProjectId } from "@/lib/web3/wagmi";

export function WalletArea() {
  const { open } = useAppKit();
  const { address, isConnected, chainId, isConnecting, isReconnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const wbt = useBalance({ address, query: { enabled: Boolean(address) } });
  const usdt = useBalance({
    address,
    token: contracts.usdt.address,
    query: { enabled: Boolean(address) },
  });

  if (!reownProjectId) {
    return (
      <div className="max-w-[220px] text-right text-[11px] leading-snug text-warning">
        Set <span className="font-mono">NEXT_PUBLIC_REOWN_PROJECT_ID</span> to enable wallet connect.
      </div>
    );
  }

  if (isConnecting || isReconnecting) {
    return <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />;
  }

  if (!isConnected || !address) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => open()}>
        Connect wallet
      </Button>
    );
  }

  const wrong = chainId !== config.chainId;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => open({ view: "Account" })}
        className="hidden rounded-md border border-border px-2 py-1 text-left text-[11px] leading-tight hover:bg-accent sm:block"
      >
        <div className="font-mono">{abbreviateAddress(address)}</div>
        <div className="text-muted-foreground">
          {wbt.data
            ? `${Number(formatUnits(wbt.data.value, wbt.data.decimals)).toFixed(4)} WBT`
            : "— WBT"}
          {" · "}
          {usdt.data
            ? `${Number(formatUnits(usdt.data.value, usdt.data.decimals)).toFixed(2)} USDT`
            : "— USDT"}
        </div>
      </button>
      {wrong ? (
        <Button type="button" size="sm" variant="destructive" onClick={() => open({ view: "Networks" })}>
          Wrong network
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => open()}>
          Wallet
        </Button>
      )}
      <Button type="button" size="sm" variant="ghost" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </div>
  );
}
