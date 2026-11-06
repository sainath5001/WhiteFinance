"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navForRole } from "@/components/layout/nav-config";
import { useDemoRole } from "@/components/layout/role-provider";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role } = useDemoRole();
  const items = navForRole(role);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card/40">
      <div className="border-b border-border px-5 py-4">
        <Link href="/" className="block" onClick={onNavigate}>
          <div className="text-lg font-semibold tracking-tight">WhiteFinance</div>
          <div className="text-xs text-muted-foreground">Business finance · testnet</div>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active =
            item.href === "/app"
              ? pathname === "/app"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4 text-[11px] leading-relaxed text-muted-foreground">
        Testnet. Tokens have no value. Chain is source of truth.
      </div>
    </aside>
  );
}
