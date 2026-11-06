"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useWriteContract } from "wagmi";
import { PageHeader } from "@/components/shared/page-header";
import { WalletGate } from "@/components/shared/wallet-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contracts } from "@/lib/web3/contracts";
import { ROLE_BITS } from "@/lib/web3/format";
import { humanizeWeb3Error } from "@/lib/web3/errors";
import { waitSoftReceipt } from "@/lib/web3/tx";
import { explorerTx } from "@/lib/config";

const schema = z.object({
  displayName: z.string().min(1).max(64),
  payoutAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address"),
  webhookUrl: z.string().url().or(z.literal("")).optional(),
  rolesMerchant: z.boolean(),
  rolesSeller: z.boolean(),
  rolesBuyer: z.boolean(),
  rolesInvestor: z.boolean(),
  acceptPublicWebhook: z.literal(true, {
    errorMap: () => ({ message: "Required" }),
  }),
});

type FormValues = z.infer<typeof schema>;

export default function MerchantOnboardPage() {
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: "",
      payoutAddress: "",
      webhookUrl: "",
      rolesMerchant: true,
      rolesSeller: true,
      rolesBuyer: false,
      rolesInvestor: false,
    },
  });

  return (
    <div className="mx-auto max-w-xl animate-fade-in">
      <PageHeader
        title="Business onboarding"
        description="Broadcasts BusinessRegistry.register on Whitechain Sepolia."
      />
      <WalletGate>
        <Card>
          <CardHeader>
            <CardTitle>Register business</CardTitle>
            <CardDescription>
              Roles are a bitmask. Webhook URL is public onchain if set.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setError(null);
                setTxHash(null);
                try {
                  let roles = 0;
                  if (values.rolesMerchant) roles |= ROLE_BITS.MERCHANT;
                  if (values.rolesSeller) roles |= ROLE_BITS.SELLER;
                  if (values.rolesBuyer) roles |= ROLE_BITS.BUYER;
                  if (values.rolesInvestor) roles |= ROLE_BITS.INVESTOR;
                  if (roles === 0) throw new Error("Select at least one role");
                  const hash = await writeContractAsync({
                    address: contracts.businessRegistry.address,
                    abi: contracts.businessRegistry.abi,
                    functionName: "register",
                    args: [
                      values.displayName,
                      roles,
                      values.payoutAddress as `0x${string}`,
                      values.webhookUrl || "",
                    ],
                  });
                  await waitSoftReceipt(hash);
                  setTxHash(hash);
                } catch (err) {
                  setError(humanizeWeb3Error(err));
                }
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
                <Input
                  id="payoutAddress"
                  className="font-mono text-xs"
                  {...register("payoutAddress")}
                />
                {errors.payoutAddress ? (
                  <p className="text-xs text-destructive">{errors.payoutAddress.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Webhook URL (optional, public onchain)</Label>
                <Textarea id="webhookUrl" {...register("webhookUrl")} />
              </div>
              <fieldset className="space-y-2 text-sm">
                <legend className="font-medium">Roles</legend>
                <label className="flex gap-2">
                  <input type="checkbox" {...register("rolesMerchant")} /> Merchant
                </label>
                <label className="flex gap-2">
                  <input type="checkbox" {...register("rolesSeller")} /> Seller
                </label>
                <label className="flex gap-2">
                  <input type="checkbox" {...register("rolesBuyer")} /> Buyer
                </label>
                <label className="flex gap-2">
                  <input type="checkbox" {...register("rolesInvestor")} /> Investor
                </label>
              </fieldset>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" {...register("acceptPublicWebhook")} />
                <span>
                  I understand the webhook URL is public onchain and delivery is best-effort, not
                  guaranteed.
                </span>
              </label>
              {errors.acceptPublicWebhook ? (
                <p className="text-xs text-destructive">
                  You must acknowledge the public webhook warning.
                </p>
              ) : null}
              <Button type="submit" disabled={isPending}>
                Register onchain
              </Button>
            </form>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            {txHash ? (
              <a
                className="mt-3 block break-all font-mono text-xs text-primary underline"
                href={explorerTx(txHash as `0x${string}`)}
                target="_blank"
                rel="noreferrer"
              >
                {txHash}
              </a>
            ) : null}
          </CardContent>
        </Card>
      </WalletGate>
    </div>
  );
}
