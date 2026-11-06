import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddressText } from "@/components/shared/address";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VolumeChart } from "@/components/charts/volume-chart";
import {
  demoIntents,
  demoMerchant,
  demoMetrics,
  demoVolumeSeries,
} from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

export default function MerchantOverviewPage() {
  const recent = demoIntents.slice(0, 5);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Merchant overview"
        description={`${demoMerchant.name} · demo fixtures`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/app/merchant/onboard">Onboarding</Link>
            </Button>
            <Button asChild>
              <Link href="/app/merchant/intents/new">
                <Plus className="h-4 w-4" /> New payment link
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total settled" value={formatUsdt(demoMetrics.volumeSettledUsdt)} hint="Demo series" />
        <MetricCard label="Successful" value={String(demoMetrics.successfulPayments)} />
        <MetricCard label="Pending" value={String(demoMetrics.pendingPayments)} />
        <MetricCard label="Refunds" value={formatUsdt(demoMetrics.refundsUsdt)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Settled volume</CardTitle>
            <CardDescription>Last 14 days · demo fixture series, not live events</CardDescription>
          </CardHeader>
          <CardContent>
            <VolumeChart data={demoVolumeSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
            <CardDescription>Registration profile (demo)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-muted-foreground">Display name</div>
              <div>{demoMerchant.name}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Account</div>
              <AddressText address={demoMerchant.address} />
            </div>
            <div>
              <div className="text-muted-foreground">Payout</div>
              <AddressText address={demoMerchant.payoutAddress} />
            </div>
            <div>
              <div className="text-muted-foreground">Webhook</div>
              <div className="break-all font-mono text-xs">{demoMerchant.webhookUrl}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Webhook URLs onchain are public. Delivery is best-effort.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent transactions</CardTitle>
            <CardDescription>Demo payment intents</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/app/merchant/intents">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.orderRef}</TableCell>
                  <TableCell className="tabular">{formatUsdt(i.amountUsdt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={i.status} />
                  </TableCell>
                  <TableCell>
                    {i.confirmationStage ? <StatusBadge status={i.confirmationStage} /> : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/app/merchant/intents/${i.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
