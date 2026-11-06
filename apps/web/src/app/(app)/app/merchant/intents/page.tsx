"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { demoIntents, type DemoIntentStatus } from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

const filters: Array<DemoIntentStatus | "ALL"> = [
  "ALL",
  "CREATED",
  "SETTLED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "EXPIRED",
  "CANCELLED",
];

export default function PaymentLinksPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("ALL");
  const rows = useMemo(
    () => (filter === "ALL" ? demoIntents : demoIntents.filter((i) => i.status === filter)),
    [filter],
  );

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Payment links"
        description="Intent history from demo fixtures"
        actions={
          <Button asChild>
            <Link href="/app/merchant/intents/new">
              <Plus className="h-4 w-4" /> Create link
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? "All" : f.replaceAll("_", " ")}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ref</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confirmation</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.orderRef}</TableCell>
                  <TableCell className="tabular">{formatUsdt(i.amountUsdt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={i.status} />
                  </TableCell>
                  <TableCell>
                    {i.confirmationStage ? <StatusBadge status={i.confirmationStage} /> : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(i.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/app/merchant/intents/${i.id}`}>Details</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/pay/${i.id}`}>Checkout</Link>
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
