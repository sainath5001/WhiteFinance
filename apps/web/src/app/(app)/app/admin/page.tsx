import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddressText } from "@/components/shared/address";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  demoActivity,
  demoBusinesses,
  demoBuyerFinancing,
  demoRelayer,
  demoSellerFinancing,
  PAYMENT_PROCESSOR,
  PRIZE_USDT,
} from "@/lib/demo/fixtures";

export default function AdminPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Admin"
        description="Read-only operational views in this stage. No privileged write controls unless contracts support them."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Businesses" value={String(demoBusinesses.length)} hint="Demo fixtures" />
        <MetricCard
          label="Seller financing"
          value={String(demoSellerFinancing.length)}
        />
        <MetricCard label="Buyer financing" value={String(demoBuyerFinancing.length)} />
        <MetricCard
          label="Relayer"
          value={demoRelayer.paused ? "Paused" : "OK"}
          hint={`WBT ${demoRelayer.wbtBalance} · demo`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Emergency indicators</CardTitle>
            <CardDescription>Status only — pause/unpause actions not exposed in UI stage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Protocol pause</span>
              <Badge variant="success">Unpaused (demo)</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Relayer pause</span>
              <Badge variant={demoRelayer.paused ? "danger" : "success"}>
                {demoRelayer.paused ? "Paused" : "Running"} · demo
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>PaymentProcessor</span>
              <AddressText address={PAYMENT_PROCESSOR} />
            </div>
            <div className="flex items-center justify-between">
              <span>Prize USDT</span>
              <AddressText address={PRIZE_USDT} />
            </div>
            <p className="text-xs text-muted-foreground">
              No “withdraw all” control exists. Admin cannot siphon protocol USDT through this UI.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relayer health</CardTitle>
            <CardDescription>Fixture values until live /api/v1/relayer/health is wired into UI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Address</span>
              <AddressText address={demoRelayer.address} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">WBT balance</span>
              <span className="tabular">{demoRelayer.wbtBalance}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Budget remaining (wei)</span>
              <span className="font-mono text-xs">{demoRelayer.budgetRemainingWei}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business registrations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoBusinesses.map((b) => (
                <TableRow key={b.address}>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>
                    <AddressText address={b.address} />
                  </TableCell>
                  <TableCell>{b.roles}</TableCell>
                  <TableCell>
                    <StatusBadge status={b.active ? "ACTIVE" : "CANCELLED"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent protocol activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {demoActivity.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0">
              <div>
                <div className="text-sm font-medium">{a.label}</div>
                <div className="text-xs text-muted-foreground">{a.detail}</div>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
