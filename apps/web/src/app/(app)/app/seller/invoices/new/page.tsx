"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      buyer: "0x4444444444444444444444444444444444444444",
      invoiceNumber: "NW-2026-05",
      faceValueUsdt: "10000",
      dueDate: "2026-12-31",
      document: "po-sample.pdf",
    },
  });

  return (
    <div className="mx-auto max-w-xl animate-fade-in">
      <PageHeader title="Create invoice" description="Demo form · document hash is tamper evidence only" />
      <Card>
        <CardHeader>
          <CardTitle>Invoice details</CardTitle>
          <CardDescription>A hash does not prove authenticity.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={handleSubmit(() => {
              window.alert("Demo only: invoice form validated. No chain write.");
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
              <Label>Demo document</Label>
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
              <p className="font-mono text-[11px] text-muted-foreground">
                documentHash (demo): 0xdoc…hash · keccak256 placeholder
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" {...register("acknowledgeHash")} />
              <span>A hash does not prove this invoice is authentic.</span>
            </label>
            {errors.acknowledgeHash ? (
              <p className="text-xs text-destructive">Acknowledgement required</p>
            ) : null}
            <Button type="submit">Validate invoice form</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
