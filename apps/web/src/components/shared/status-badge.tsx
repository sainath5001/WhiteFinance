import { Badge } from "@/components/ui/badge";

const map: Record<string, "success" | "warning" | "danger" | "muted" | "default" | "secondary"> = {
  SETTLED: "success",
  REPAID: "success",
  ACTIVE: "default",
  CREATED: "secondary",
  REQUESTED: "secondary",
  BUYER_CONFIRMED: "default",
  PARTIALLY_REFUNDED: "warning",
  OVERDUE: "warning",
  EXPIRED: "muted",
  CANCELLED: "muted",
  REFUNDED: "muted",
  DEFAULTED: "danger",
  DISPUTED: "danger",
  soft: "warning",
  safe: "default",
  finalized: "success",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = map[status] ?? "muted";
  return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}
