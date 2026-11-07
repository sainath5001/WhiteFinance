import { AlertTriangle } from "lucide-react";
import { DEMO_BANNER } from "@/lib/demo/fixtures";

export function DemoBanner() {
  return (
    <div className="flex items-start gap-2 border-b border-border bg-muted/60 px-4 py-2 text-xs text-muted-foreground sm:items-center">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary sm:mt-0" />
      <p>{DEMO_BANNER}</p>
    </div>
  );
}
