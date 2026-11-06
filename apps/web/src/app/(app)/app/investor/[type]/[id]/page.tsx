"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddressText } from "@/components/shared/address";
import { ErrorState } from "@/components/shared/error-state";
import { WalletGate } from "@/components/shared/wallet-gate";
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
import { Skeleton } from "@/components/ui/skeleton";
import { contracts } from "@/lib/web3/contracts";
import { baseToUsdt } from "@/lib/web3/format";
import { humanizeWeb3Error } from "@/lib/web3/errors";
import { ensureUsdtAllowance } from "@/lib/web3/approve";
import { useBuyerFinancing, useSellerFinancing } from "@/lib/web3/hooks/use-financing";
import { waitSoftReceipt } from "@/lib/web3/tx";
import { explorerTx } from "@/lib/config";

export default function FinancingDetailPage() {
  const params = useParams<{ type: string; id: string }>();
  const isSeller = params.type === "seller";
  const seller = useSellerFinancing(isSeller ? params.id : undefined);
  const buyer = useBuyerFinancing(!isSeller && params.type === "buyer" ? params.id : undefined);
  const financing = isSeller ? seller.data : buyer.data;
  const loading = isSeller ? seller.loading : buyer.loading;
  const error = isSeller ? seller.error : buyer.error;
  const refresh = isSeller ? seller.refresh : buyer.refresh;

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [msg, setMsg] = useState<string | null>(null);

  if (params.type !== "seller" && params.type !== "buyer") {
    return <ErrorState title="Invalid type" description="Use /app/investor/seller|buyer/:id" />;
  }
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error || !financing) {
    return (
      <ErrorState description={error || "Position not found"} onRetry={() => void refresh()} />
    );
  }

  const fundTarget = isSeller ? contracts.sellerFinancing : contracts.buyerFinancing;
  const fundAmount = isSeller
    ? BigInt((financing as typeof seller.data)!.advanceAmountBase)
    : BigInt((financing as typeof buyer.data)!.principalBase);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={`${financing.type} financing #${financing.financingId}`}
        description={`Invoice #${financing.invoiceId} · onchain position`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/investor/opportunities">Back</Link>
            </Button>
          </>
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
            <Row
              label="Face value"
              value={`${"faceValueUsdt" in financing && financing.faceValueUsdt ? financing.faceValueUsdt : baseToUsdt(financing.faceValueBase)} USDT`}
            />
            {isSeller && "advanceAmountBase" in financing ? (
              <>
                <Row
                  label="Advance (to seller)"
                  value={`${baseToUsdt(financing.advanceAmountBase)} USDT`}
                />
                <Row
                  label="Discount"
                  value={`${baseToUsdt(financing.discountAmountBase)} USDT`}
                />
                <Row
                  label="Expected gross repayment to investor"
                  value={`${financing.accounting.investorReceivesOnRepay} USDT`}
                />
                <Row
                  label="Investor profit if repaid"
                  value={`${financing.accounting.investorProfitIfRepaid} USDT`}
                />
              </>
            ) : "principalBase" in financing ? (
              <>
                <Row
                  label="Principal (to seller)"
                  value={`${baseToUsdt(financing.principalBase)} USDT`}
                />
                <Row label="Fee" value={`${baseToUsdt(financing.feeBase)} USDT`} />
                <Row
                  label="Seller remainder"
                  value={`${baseToUsdt(financing.sellerRemainderBase)} USDT`}
                />
                <Row
                  label="Investor receivable"
                  value={`${financing.accounting.investorReceivable} USDT`}
                />
                <p className="text-xs text-muted-foreground">{financing.accounting.note}</p>
              </>
            ) : null}
            <Row label="Due date" value={new Date(financing.dueDate * 1000).toLocaleString()} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Buyer may default. Protocol does not create legal assignment.</p>
            <div>
              <div className="text-foreground">Seller</div>
              <AddressText address={financing.seller} />
            </div>
            <div>
              <div className="text-foreground">Buyer</div>
              <AddressText address={financing.buyer} />
            </div>
            <WalletGate>
              {financing.status === "REQUESTED" ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="mt-2" disabled={isPending}>
                      Fund position
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm funding</DialogTitle>
                      <DialogDescription>
                        Approves prize USDT then calls fund(). Success only after receipt.
                      </DialogDescription>
                    </DialogHeader>
                    <Button
                      disabled={isPending}
                      onClick={() => {
                        setMsg(null);
                        void (async () => {
                          try {
                            if (!address || !publicClient) throw new Error("Wallet not ready");
                            await ensureUsdtAllowance({
                              publicClient,
                              owner: address,
                              spender: fundTarget.address,
                              amount: fundAmount,
                              writeContractAsync: writeContractAsync as never,
                            });
                            const hash = await writeContractAsync({
                              address: fundTarget.address,
                              abi: fundTarget.abi,
                              functionName: "fund",
                              args: [BigInt(financing.financingId)],
                            });
                            await waitSoftReceipt(hash);
                            setMsg(`Funded: ${hash}`);
                            await refresh();
                          } catch (err) {
                            setMsg(humanizeWeb3Error(err));
                          }
                        })();
                      }}
                    >
                      Confirm funding onchain
                    </Button>
                  </DialogContent>
                </Dialog>
              ) : (
                <p className="text-foreground">
                  Investor:{" "}
                  {financing.investor ? <AddressText address={financing.investor} /> : "—"}
                </p>
              )}
              {isSeller &&
              financing.status === "ACTIVE" &&
              "repaid" in financing &&
              !financing.repaid ? (
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    setMsg(null);
                    void (async () => {
                      try {
                        if (!address || !publicClient) throw new Error("Wallet not ready");
                        await ensureUsdtAllowance({
                          publicClient,
                          owner: address,
                          spender: contracts.sellerFinancing.address,
                          amount: BigInt(financing.faceValueBase),
                          writeContractAsync: writeContractAsync as never,
                        });
                        const hash = await writeContractAsync({
                          address: contracts.sellerFinancing.address,
                          abi: contracts.sellerFinancing.abi,
                          functionName: "repay",
                          args: [BigInt(financing.financingId)],
                        });
                        await waitSoftReceipt(hash);
                        setMsg(`Repaid: ${hash}`);
                        await refresh();
                      } catch (err) {
                        setMsg(humanizeWeb3Error(err));
                      }
                    })();
                  }}
                >
                  Repay investor (buyer)
                </Button>
              ) : null}
            </WalletGate>
            {msg ? (
              <p className="break-all text-xs">
                {msg.includes("0x") ? (
                  <a
                    className="text-primary underline"
                    href={explorerTx((msg.match(/0x[a-fA-F0-9]{64}/)?.[0] || "0x") as `0x${string}`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {msg}
                  </a>
                ) : (
                  <span className="text-destructive">{msg}</span>
                )}
              </p>
            ) : null}
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
