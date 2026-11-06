import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeDollarSign,
  Building2,
  FileText,
  HandCoins,
  LayoutDashboard,
  Link2,
  Settings,
  Shield,
  Store,
  WalletCards,
} from "lucide-react";
import type { DemoRole } from "@/lib/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: DemoRole[];
};

export const primaryNav: NavItem[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/merchant", label: "Payments", icon: BadgeDollarSign, roles: ["merchant", "admin"] },
  {
    href: "/app/merchant/intents",
    label: "Payment links",
    icon: Link2,
    roles: ["merchant", "admin"],
  },
  { href: "/app/seller", label: "Invoices", icon: FileText, roles: ["seller", "merchant", "admin"] },
  {
    href: "/app/seller/financing",
    label: "Seller financing",
    icon: HandCoins,
    roles: ["seller", "merchant", "admin"],
  },
  {
    href: "/app/buyer",
    label: "Buyer financing",
    icon: WalletCards,
    roles: ["buyer", "admin"],
  },
  {
    href: "/app/investor",
    label: "Investments",
    icon: Building2,
    roles: ["investor", "admin"],
  },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/admin", label: "Admin", icon: Shield, roles: ["admin"] },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/demo/store", label: "Demo store", icon: Store },
];

export function navForRole(role: DemoRole) {
  return primaryNav.filter((item) => !item.roles || item.roles.includes(role));
}
