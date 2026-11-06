"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddressText } from "@/components/shared/address";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getDemoBuyerFinancing, getDemoSellerFinancing } from "@/lib/demo/fixtures";
import { formatUsdt } from "@/lib/utils";

export default function FinancingDetailPage() {
  const params = useParams<{ type: string; id: string }>();
  const financing =
    params.type === "seller"
      ? getDemoSellerFinancing(params.id)
      : params.type === "buyer"
        ? getDemoBuyerFinancing(params.id)
        : null;

  if (!financing) {
    return <ErrorState title="Position not found" description="No demo fixture for this financing id." />;
  }

  const isSeller = financing.type === "seller";

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={`${financing.type} financing #${financing.id}`}
        description={`${financing.invoiceNumber} · demo fixture`}
        actions={
          <Button asChild variant="outline">
            <Link href="/app/investor/opportunities">Back to opportunities</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Accounting</CardTitle>
            <CardDescription>Figures are not guaranteed returns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <StatusBadge status={financing.status} />
            <Row label="Face value" value={formatUsdt(financing.faceValueUsdt, 0)} />
            {isSeller ? (
              <>
                <Row label="Advance (to seller)" value={formatUsdt(financing.advanceUsdt, 0)} />
                <Row label="Discount" value={formatUsdt(financing.discountUsdt, 0)} />
              </>
            ) : (
              <>
                <Row label="Principal (to seller)" value={formatUsdt(financing.principalUsdt, 0)} />
                <Row label="Fee" value={formatUsdt(financing.feeUsdt, 0)} />
                <Row label="Seller remainder" value={formatUsdt(financing.sellerRemainderUsdt, 0)} />
              </>
            )}
            <Row
              label="Expected gross repayment to investor"
              value={formatUsdt(financing.expectedGrossRepaymentUsdt, 0)}
            />
            <Row label="Due date" value={financing.dueDate} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Buyer may default. Protocol does not create legal assignment.</p>
            <p>Prize USDT issuer may block addresses.</p>
            <p>Soft confirmations can disappear on reorg.</p>
            <div>
              <div className="text-foreground">Seller</div>
              <AddressText address={financing.seller} />
            </div>
            <div>
              <div className="text-foreground">Buyer</div>
              <AddressText address={financing.buyer} />
            </div>
            {financing.status === "REQUESTED" ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="mt-2">Fund position (demo)</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm funding</DialogTitle>
                    <DialogDescription>
                      Demo only. Live fund() needs USDT approval + WBT and is not wired.
                    </DialogDescription>
                  </DialogHeader>
                  <Button onClick={() => window.alert("Demo only: funding confirmation UI.")}>
                    Confirm funding
                  </Button>
                </DialogContent>
              </Dialog>
            ) : (
              <p className="text-foreground">
                Investor:{" "}
                {financing.investor ? <AddressText address={financing.investor} /> : "—"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular text-right">{value}</span>
    </div>
  );
}
