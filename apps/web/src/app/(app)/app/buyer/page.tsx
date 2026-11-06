import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { MetricCard } from "@/components/shared/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { demoBuyerFinancing, demoInvoices } from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

export default function BuyerDashboardPage() {
  const inbox = demoInvoices;
  const activeFinancing = demoBuyerFinancing.filter((f) => f.status === "ACTIVE" || f.status === "REQUESTED");

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Buyer workspace"
        description="Received invoices and financing · demo fixtures"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="To confirm" value={String(inbox.filter((i) => i.status === "CREATED").length)} />
        <MetricCard
          label="Still owed to sellers"
          value={formatUsdt(inbox.reduce((s, i) => s + i.outstandingToSeller, 0), 0)}
        />
        <MetricCard
          label="Investor receivables"
          value={formatUsdt(activeFinancing.reduce((s, f) => s + f.expectedGrossRepaymentUsdt, 0), 0)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Received invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Face</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {inbox.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.number}</TableCell>
                  <TableCell className="tabular">{formatUsdt(inv.faceValueUsdt, 0)}</TableCell>
                  <TableCell>
                    <StatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/app/buyer/invoices/${inv.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buyer financing</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Seller remainder</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoBuyerFinancing.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.invoiceNumber}</TableCell>
                  <TableCell className="tabular">{formatUsdt(f.principalUsdt, 0)}</TableCell>
                  <TableCell className="tabular">{formatUsdt(f.feeUsdt, 0)}</TableCell>
                  <TableCell className="tabular">{formatUsdt(f.sellerRemainderUsdt, 0)}</TableCell>
                  <TableCell>
                    <StatusBadge status={f.status} />
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
