import { StatusBadge } from "@/components/shared/status-badge";

const stages = ["Idle", "Wallet prompt", "Pending", "Soft confirmed", "Safe", "Finalized"] as const;

export function TransactionStatus({
  current = "Idle",
  note,
}: {
  current?: (typeof stages)[number] | "Failed" | "Rejected" | "Reorged";
  note?: string;
}) {
  const failed = current === "Failed" || current === "Rejected" || current === "Reorged";
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Transaction status</p>
        <StatusBadge status={current === "Soft confirmed" ? "soft" : current.toUpperCase()} />
      </div>
      <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stages.map((s) => {
          const active = s === current;
          return (
            <li
              key={s}
              className={`rounded-md border px-2 py-2 text-center text-[11px] ${
                active ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {s}
            </li>
          );
        })}
      </ol>
      {failed ? (
        <p className="mt-3 text-sm text-destructive">
          {current}. Soft inclusion is never shown as final. Re-check the chain before fulfilling.
        </p>
      ) : null}
      {note ? <p className="mt-3 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
