"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { keccak256, stringToHex, parseEventLogs } from "viem";
import { useWriteContract } from "wagmi";
import { PageHeader } from "@/components/shared/page-header";
import { WalletGate } from "@/components/shared/wallet-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { contracts } from "@/lib/web3/contracts";
import { stringToBytes32 } from "@/lib/services/encode";
import { usdtToBase } from "@/lib/web3/format";
import { humanizeWeb3Error } from "@/lib/web3/errors";
import { waitSoftReceipt } from "@/lib/web3/tx";
import { explorerTx } from "@/lib/config";
import Link from "next/link";

const schema = z.object({
  buyer: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  invoiceNumber: z.string().min(1).max(64),
  faceValueUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
  dueDate: z.string().min(1),
  document: z.string().min(1),
  acknowledgeHash: z.literal(true),
});

type FormValues = z.infer<typeof schema>;

export default function NewInvoicePage() {
  const { writeContractAsync, isPending } = useWriteContract();
  const [result, setResult] = useState<{ id: string; txHash: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      buyer: "",
      invoiceNumber: "",
      faceValueUsdt: "100000",
      dueDate: "",
      document: "po-sample.pdf",
    },
  });

  const document = watch("document");
  const documentHash = keccak256(stringToHex(`whitefinance-demo-doc:${document}`));
  const termsHash = keccak256(stringToHex("whitefinance-demo-terms-v1"));

  return (
    <div className="mx-auto max-w-xl animate-fade-in">
      <PageHeader title="Create invoice" description="Broadcasts InvoiceRegistry.createInvoice" />
      <WalletGate>
        <Card>
          <CardHeader>
            <CardTitle>Invoice details</CardTitle>
            <CardDescription>A hash does not prove authenticity.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setError(null);
                setResult(null);
                try {
                  const due = BigInt(Math.floor(new Date(values.dueDate).getTime() / 1000));
                  const hash = await writeContractAsync({
                    address: contracts.invoiceRegistry.address,
                    abi: contracts.invoiceRegistry.abi,
                    functionName: "createInvoice",
                    args: [
                      values.buyer as `0x${string}`,
                      stringToBytes32(values.invoiceNumber),
                      usdtToBase(values.faceValueUsdt),
                      due,
                      documentHash,
                      termsHash,
                    ],
                  });
                  const receipt = await waitSoftReceipt(hash);
                  const logs = parseEventLogs({
                    abi: contracts.invoiceRegistry.abi,
                    logs: receipt.logs,
                    eventName: "InvoiceCreated",
                  });
                  const invoiceId = (logs[0]?.args as { invoiceId?: bigint } | undefined)?.invoiceId;
                  if (invoiceId == null) throw new Error("InvoiceCreated event missing");
                  setResult({ id: invoiceId.toString(), txHash: hash });
                } catch (err) {
                  setError(humanizeWeb3Error(err));
                }
              })}
            >
              <div className="space-y-2">
                <Label>Buyer address</Label>
                <Input className="font-mono text-xs" {...register("buyer")} />
                {errors.buyer ? <p className="text-xs text-destructive">Invalid buyer address</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Invoice number</Label>
                <Input {...register("invoiceNumber")} />
              </div>
              <div className="space-y-2">
                <Label>Face value (USDT)</Label>
                <Input className="tabular" {...register("faceValueUsdt")} />
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input type="date" {...register("dueDate")} />
              </div>
              <div className="space-y-2">
                <Label>Demo document (hashed client-side)</Label>
                <Select
                  defaultValue="po-sample.pdf"
                  onValueChange={(v) => setValue("document", v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="po-sample.pdf">po-sample.pdf</SelectItem>
                    <SelectItem value="invoice-template.pdf">invoice-template.pdf</SelectItem>
                    <SelectItem value="packing-list.pdf">packing-list.pdf</SelectItem>
                  </SelectContent>
                </Select>
                <p className="break-all font-mono text-[11px] text-muted-foreground">{documentHash}</p>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" {...register("acknowledgeHash")} />
                <span>A hash does not prove this invoice is authentic.</span>
              </label>
              {errors.acknowledgeHash ? (
                <p className="text-xs text-destructive">Acknowledgement required</p>
              ) : null}
              <Button type="submit" disabled={isPending}>
                Create invoice onchain
              </Button>
            </form>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            {result ? (
              <div className="mt-4 space-y-2 rounded-md border border-border p-3 text-sm">
                <p>Invoice #{result.id}</p>
                <a className="break-all font-mono text-xs text-primary underline" href={explorerTx(result.txHash as `0x${string}`)} target="_blank" rel="noreferrer">
                  {result.txHash}
                </a>
                <Button asChild size="sm">
                  <Link href={`/app/seller/invoices/${result.id}`}>Open invoice</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </WalletGate>
    </div>
  );
}
