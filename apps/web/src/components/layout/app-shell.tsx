"use client";

import { useState } from "react";
import { DemoBanner } from "@/components/shared/demo-banner";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { RoleProvider } from "@/components/layout/role-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <RoleProvider>
      <div className="min-h-screen">
        <DemoBanner />
        <div className="flex min-h-[calc(100vh-37px)]">
          <div className="hidden lg:block">
            <Sidebar />
          </div>

          {open ? (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button
                className="absolute inset-0 bg-black/60"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              />
              <div className="absolute inset-y-0 left-0 shadow-xl">
                <Sidebar onNavigate={() => setOpen(false)} />
              </div>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <Header onMenu={() => setOpen(true)} />
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </div>
    </RoleProvider>
  );
}
