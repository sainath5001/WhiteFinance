import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { demoInvoices } from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

export default function SellerOverviewPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Seller overview"
        description="Invoices and factoring · demo fixtures"
        actions={
          <Button asChild>
            <Link href="/app/seller/invoices/new">
              <Plus className="h-4 w-4" /> New invoice
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Open invoices" value={String(demoInvoices.filter((i) => i.status !== "SETTLED").length)} />
        <MetricCard label="Confirmed" value={String(demoInvoices.filter((i) => i.status === "BUYER_CONFIRMED").length)} />
        <MetricCard label="Face value outstanding" value={formatUsdt(demoInvoices.reduce((s, i) => s + i.outstandingToSeller, 0))} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Face</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.number}</TableCell>
                  <TableCell className="tabular">{formatUsdt(inv.faceValueUsdt, 0)}</TableCell>
                  <TableCell>{inv.dueDate}</TableCell>
                  <TableCell>
                    <StatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/app/seller/invoices/${inv.id}`}>Open</Link>
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
