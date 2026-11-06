"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { abbreviateAddress, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AddressText({
  address,
  className,
  mono = true,
}: {
  address: string;
  className?: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={cn(mono && "font-mono text-xs")}>{abbreviateAddress(address)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={async () => {
          await navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        aria-label="Copy address"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </span>
  );
}
