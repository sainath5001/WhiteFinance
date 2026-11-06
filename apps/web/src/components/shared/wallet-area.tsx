"use client";

import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

/** UI-only wallet area. Live wagmi/Reown integration is intentionally not wired in this stage. */
export function WalletArea() {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled title="Wallet integration comes in the next stage">
        <Wallet className="h-4 w-4" />
        Connect wallet
      </Button>
      <span className="hidden text-[11px] text-muted-foreground sm:inline">UI stage · not live</span>
    </div>
  );
}
