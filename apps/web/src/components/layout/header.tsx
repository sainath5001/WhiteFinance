"use client";

import { Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WalletArea } from "@/components/shared/wallet-area";
import { RelayerStatusBadge } from "@/components/shared/relayer-status";
import { DEMO_ROLES, ROLE_LABEL, type DemoRole } from "@/lib/roles";
import { useDemoRole } from "@/components/layout/role-provider";
import { useRouter } from "next/navigation";
import { ROLE_HOME } from "@/lib/roles";

export function Header({ onMenu }: { onMenu?: () => void }) {
  const { role, setRole } = useDemoRole();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>

      <Badge variant="outline" className="hidden font-mono sm:inline-flex">
        Whitechain Sepolia · 1874
      </Badge>

      <RelayerStatusBadge />

      <div className="ml-auto flex items-center gap-2">
        <Select
          value={role}
          onValueChange={(v) => {
            const next = v as DemoRole;
            setRole(next);
            router.push(ROLE_HOME[next]);
          }}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            {DEMO_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <WalletArea />
      </div>
    </header>
  );
}
