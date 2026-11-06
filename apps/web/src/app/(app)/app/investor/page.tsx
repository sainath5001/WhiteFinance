"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { demoBuyerFinancing, demoSellerFinancing } from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

export default function InvestorOverviewPage() {
  const portfolio = [...demoSellerFinancing, ...demoBuyerFinancing].filter(
    (f) => f.investor || f.status === "REQUESTED",
  );
  const active = portfolio.filter((f) => f.status === "ACTIVE");
  const chartData = [
    {
      name: "Outstanding",
      value: active.reduce(
        (s, f) => s + ("advanceUsdt" in f ? f.advanceUsdt : f.principalUsdt),
        0,
      ),
    },
    {
      name: "Expected gross",
      value: active.reduce((s, f) => s + f.expectedGrossRepaymentUsdt, 0),
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Investor overview"
        description="Expected figures are contractual maths, not guaranteed returns"
        actions={
          <Button asChild>
            <Link href="/app/investor/opportunities">Browse opportunities</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Active positions" value={String(active.length)} />
        <MetricCard
          label="Expected gross repayment"
          value={formatUsdt(
            active.reduce((s, f) => s + f.expectedGrossRepaymentUsdt, 0),
            0,
          )}
          hint="Not a guaranteed return"
        />
        <MetricCard
          label="Open requests"
          value={String(portfolio.filter((f) => f.status === "REQUESTED").length)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio mix</CardTitle>
          <CardDescription>Demo chart from fixture totals</CardDescription>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke="hsl(220 12% 18%)" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: "hsl(220 8% 58%)", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(220 8% 58%)", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(220 14% 9%)",
                  border: "1px solid hsl(220 12% 18%)",
                }}
              />
              <Bar dataKey="value" fill="hsl(24 92% 52%)" name="USDT" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Deployed / principal</TableHead>
                <TableHead>Expected gross</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {portfolio.map((f) => (
                <TableRow key={`${f.type}-${f.id}`}>
                  <TableCell className="capitalize">{f.type}</TableCell>
                  <TableCell>{f.invoiceNumber}</TableCell>
                  <TableCell className="tabular">
                    {formatUsdt("advanceUsdt" in f ? f.advanceUsdt : f.principalUsdt, 0)}
                  </TableCell>
                  <TableCell className="tabular">
                    {formatUsdt(f.expectedGrossRepaymentUsdt, 0)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={f.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/app/investor/${f.type}/${f.id}`}>Open</Link>
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
