"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDemoRole } from "@/components/layout/role-provider";
import { DEMO_ROLES, ROLE_HOME, ROLE_LABEL, type DemoRole } from "@/lib/roles";
import { useRouter } from "next/navigation";
import { PRIZE_USDT } from "@/lib/demo/fixtures";
import { AddressText } from "@/components/shared/address";

export default function SettingsPage() {
  const { role, setRole } = useDemoRole();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-2xl animate-fade-in space-y-6">
      <PageHeader
        title="Settings"
        description="Demo preferences only. Role switcher does not grant onchain permissions."
      />
      <Card>
        <CardHeader>
          <CardTitle>Demo role</CardTitle>
          <CardDescription>Stored in localStorage as a UI preference.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Active role</Label>
          <Select
            value={role}
            onValueChange={(v) => {
              const next = v as DemoRole;
              setRole(next);
              router.push(ROLE_HOME[next]);
            }}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEMO_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Network</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Whitechain Sepolia · chain id 1874</div>
          <div className="flex items-center gap-2">
            Prize USDT <AddressText address={PRIZE_USDT} />
          </div>
          <p className="text-xs text-muted-foreground">
            Wallet connection and contract writes are intentionally disabled in this UI stage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
