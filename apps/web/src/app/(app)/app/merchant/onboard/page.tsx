"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  displayName: z.string().min(1).max(64),
  payoutAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address"),
  webhookUrl: z.string().url().or(z.literal("")).optional(),
  acceptPublicWebhook: z.literal(true, {
    errorMap: () => ({ message: "Required" }),
  }),
});

type FormValues = z.infer<typeof schema>;

export default function MerchantOnboardPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: "Northwind Tools",
      payoutAddress: "0xAE7168d00595a769C9434AB1ddE4D9F0273177CE",
      webhookUrl: "",
    },
  });

  return (
    <div className="mx-auto max-w-xl animate-fade-in">
      <PageHeader
        title="Merchant onboarding"
        description="UI form only. Wallet broadcast of register() is not wired in this stage."
      />
      <Card>
        <CardHeader>
          <CardTitle>Register business</CardTitle>
          <CardDescription>Zod-validated. Submit shows a confirmation, not a chain write.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={handleSubmit(() => {
              window.alert(
                "Demo only: form validated. Live BusinessRegistry.register is not enabled in this UI stage.",
              );
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" {...register("displayName")} />
              {errors.displayName ? (
                <p className="text-xs text-destructive">{errors.displayName.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payoutAddress">Payout address</Label>
              <Input id="payoutAddress" className="font-mono text-xs" {...register("payoutAddress")} />
              {errors.payoutAddress ? (
                <p className="text-xs text-destructive">{errors.payoutAddress.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL (optional, public onchain)</Label>
              <Textarea id="webhookUrl" {...register("webhookUrl")} />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" {...register("acceptPublicWebhook")} />
              <span>
                I understand the webhook URL is public onchain and delivery is best-effort, not
                guaranteed.
              </span>
            </label>
            {errors.acceptPublicWebhook ? (
              <p className="text-xs text-destructive">You must acknowledge the public webhook warning.</p>
            ) : null}
            <Button type="submit">Validate registration form</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
