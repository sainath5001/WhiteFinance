"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDemoRole } from "@/components/layout/role-provider";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppHome() {
  const { home } = useDemoRole();
  const router = useRouter();

  useEffect(() => {
    router.replace(home);
  }, [home, router]);

  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
