import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { demoBuyerFinancing, demoSellerFinancing } from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

export default function OpportunitiesPage() {
  const open = [
    ...demoSellerFinancing.filter((f) => f.status === "REQUESTED"),
    ...demoBuyerFinancing.filter((f) => f.status === "REQUESTED"),
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Open financing requests"
        description="Review accounting carefully. No guaranteed returns."
      />
      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Face</TableHead>
                <TableHead>Advance / principal</TableHead>
                <TableHead>Discount / fee</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {open.map((f) => (
                <TableRow key={`${f.type}-${f.id}`}>
                  <TableCell className="capitalize">{f.type}</TableCell>
                  <TableCell>{f.invoiceNumber}</TableCell>
                  <TableCell className="tabular">{formatUsdt(f.faceValueUsdt, 0)}</TableCell>
                  <TableCell className="tabular">
                    {formatUsdt("advanceUsdt" in f ? f.advanceUsdt : f.principalUsdt, 0)}
                  </TableCell>
                  <TableCell className="tabular">
                    {formatUsdt("discountUsdt" in f ? f.discountUsdt : f.feeUsdt, 0)}
                  </TableCell>
                  <TableCell>{f.dueDate}</TableCell>
                  <TableCell>
                    <StatusBadge status={f.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm">
                      <Link href={`/app/investor/${f.type}/${f.id}`}>Review</Link>
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
