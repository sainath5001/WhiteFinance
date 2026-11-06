"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  orderRef: z.string().min(1).max(64),
  amountUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid amount"),
  payer: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address")
    .or(z.literal(""))
    .optional(),
  expiresInMinutes: z.coerce.number().int().min(5).max(10080),
});

type FormValues = z.infer<typeof schema>;

export default function NewPaymentLinkPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { orderRef: "PO-1044", amountUsdt: "25.00", payer: "", expiresInMinutes: 30 },
  });

  return (
    <div className="mx-auto max-w-xl animate-fade-in space-y-6">
      <PageHeader
        title="Create payment link"
        description="Form validates locally. createIntent is not broadcast in this UI stage."
      />
      <Card>
        <CardHeader>
          <CardTitle>Payment intent</CardTitle>
          <CardDescription>Amount is USDT with up to 6 decimals.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => {
              setPreviewUrl(`/pay/13?demoOrder=${encodeURIComponent(values.orderRef)}`);
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="orderRef">Order reference</Label>
              <Input id="orderRef" {...register("orderRef")} />
              {errors.orderRef ? <p className="text-xs text-destructive">{errors.orderRef.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amountUsdt">Amount (USDT)</Label>
              <Input id="amountUsdt" className="tabular" {...register("amountUsdt")} />
              {errors.amountUsdt ? (
                <p className="text-xs text-destructive">{errors.amountUsdt.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payer">Bound payer (optional)</Label>
              <Input id="payer" className="font-mono text-xs" placeholder="0x…" {...register("payer")} />
              {errors.payer ? <p className="text-xs text-destructive">{errors.payer.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresInMinutes">Expires in (minutes)</Label>
              <Input id="expiresInMinutes" type="number" {...register("expiresInMinutes")} />
            </div>
            <Button type="submit">Validate & preview checkout URL</Button>
          </form>
          {previewUrl ? (
            <div className="mt-6 rounded-md border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Demo checkout preview</p>
              <p className="mt-1 text-muted-foreground">
                Not created onchain. Intent ID in the link is a fixture.
              </p>
              <Link className="mt-2 inline-block text-primary underline" href={previewUrl}>
                {previewUrl}
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
