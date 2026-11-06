import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { demoSellerFinancing } from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

export default function SellerFinancingPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Seller financing"
        description="Factoring positions · demo fixtures · returns are not guaranteed"
      />
      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Advance</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Expected gross repayment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoSellerFinancing.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.invoiceNumber}</TableCell>
                  <TableCell className="tabular">{formatUsdt(f.advanceUsdt, 0)}</TableCell>
                  <TableCell className="tabular">{formatUsdt(f.discountUsdt, 0)}</TableCell>
                  <TableCell className="tabular">{formatUsdt(f.expectedGrossRepaymentUsdt, 0)}</TableCell>
                  <TableCell>
                    <StatusBadge status={f.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/app/investor/seller/${f.id}`}>Details</Link>
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
