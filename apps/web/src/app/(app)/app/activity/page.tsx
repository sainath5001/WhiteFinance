import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { demoActivity } from "@/lib/demo/fixtures";

export default function ActivityPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Activity"
        description="Cross-role event feed · demo fixtures only"
      />
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {demoActivity.map((a) => (
            <div key={a.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium">{a.label}</div>
                <div className="text-xs text-muted-foreground">{a.detail}</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">{a.type}</div>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
