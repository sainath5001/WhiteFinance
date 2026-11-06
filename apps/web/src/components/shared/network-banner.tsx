"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import { humanizeWeb3Error } from "@/lib/web3/errors";
import { useState } from "react";

export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [err, setErr] = useState<string | null>(null);

  if (!isConnected) return null;
  if (chainId === config.chainId) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p>
        Wrong network (chain {chainId ?? "unknown"}). Switch to Whitechain Sepolia ({config.chainId}).
      </p>
      <div className="flex items-center gap-2">
        {err ? <span className="text-xs text-destructive">{err}</span> : null}
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={async () => {
            setErr(null);
            try {
              await switchChainAsync({ chainId: config.chainId });
            } catch (e) {
              setErr(humanizeWeb3Error(e));
            }
          }}
        >
          Switch network
        </Button>
      </div>
    </div>
  );
}
