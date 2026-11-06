"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api/client";

type Health = {
  available?: boolean;
  paused?: boolean;
  ok?: boolean;
  reason?: string;
};

export function RelayerStatusBadge() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<Health>("/api/v1/relayer/health")
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch(() => {
        if (!cancelled) setHealth({ available: false, reason: "unreachable" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!health) {
    return (
      <Badge variant="muted" className="hidden md:inline-flex">
        Relayer …
      </Badge>
    );
  }

  if (!health.available || health.reason) {
    return (
      <Badge variant="warning" className="hidden md:inline-flex">
        Relayer offline
      </Badge>
    );
  }

  if (health.paused) {
    return (
      <Badge variant="danger" className="hidden md:inline-flex">
        Relayer paused
      </Badge>
    );
  }

  return (
    <Badge variant={health.ok === false ? "warning" : "success"} className="hidden md:inline-flex">
      Relayer {health.ok === false ? "degraded" : "ok"}
    </Badge>
  );
}
