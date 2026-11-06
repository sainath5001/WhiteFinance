"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEMO_ROLES,
  ROLE_HOME,
  ROLE_STORAGE_KEY,
  type DemoRole,
} from "@/lib/roles";

type Ctx = {
  role: DemoRole;
  setRole: (role: DemoRole) => void;
  home: string;
};

const RoleContext = createContext<Ctx | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<DemoRole>("merchant");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(ROLE_STORAGE_KEY);
    if (raw && (DEMO_ROLES as readonly string[]).includes(raw)) {
      setRoleState(raw as DemoRole);
    }
    setReady(true);
  }, []);

  const setRole = useCallback((next: DemoRole) => {
    setRoleState(next);
    window.localStorage.setItem(ROLE_STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ role, setRole, home: ROLE_HOME[role] }),
    [role, setRole],
  );

  if (!ready) return <div className="min-h-screen bg-background" />;

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useDemoRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useDemoRole must be used within RoleProvider");
  return ctx;
}
