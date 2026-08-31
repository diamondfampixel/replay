"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/admin/sidebar";
import { Topbar, type TopbarNotification } from "@/components/admin/topbar";
import { CommandBarProvider } from "@/components/admin/command-bar";
import { AssistantPanelProvider } from "@/components/admin/assistant-panel";
import type { Role } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import { useLocalFlag } from "@/lib/client-state";

const COLLAPSE_KEY = "halyard.sidebar.collapsed";

export function AdminShell({
  user,
  organizationName,
  storeName,
  storeSlug,
  role,
  notifications,
  aiConfigured,
  children,
}: {
  user: { name: string; email: string };
  organizationName: string;
  storeName: string;
  storeSlug: string;
  role: Role;
  notifications: TopbarNotification[];
  aiConfigured: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useLocalFlag(COLLAPSE_KEY, false);

  // The drawer records the route it was opened on, so a navigation closes it
  // without an effect that reaches back into state.
  const [drawer, setDrawer] = useState<{ open: boolean; path: string }>({ open: false, path: pathname });
  const mobileOpen = drawer.open && drawer.path === pathname;

  function setMobileOpen(open: boolean) {
    setDrawer({ open, path: pathname });
  }

  function toggle() {
    setCollapsed(!collapsed);
  }

  return (
    <CommandBarProvider role={role}>
      <AssistantPanelProvider aiConfigured={aiConfigured}>
      <div className="flex min-h-dvh bg-ink-50">
          <aside
            className={cn(
              "sticky top-0 hidden h-dvh shrink-0 border-r border-ink-200 transition-[width] duration-150 lg:block",
              collapsed ? "w-[60px]" : "w-[228px]",
            )}
          >
            <Sidebar
              role={role}
              storeSlug={storeSlug}
              storeName={storeName}
              collapsed={collapsed}
              onToggle={toggle}
            />
          </aside>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" width="max-w-[260px]" className="p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Sidebar
                role={role}
                storeSlug={storeSlug}
                storeName={storeName}
                collapsed={false}
                onToggle={() => setMobileOpen(false)}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              user={user}
              organizationName={organizationName}
              storeName={storeName}
              role={role}
              notifications={notifications}
              onOpenMobileNav={() => setMobileOpen(true)}
            />
            <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
          </div>
        </div>
      </AssistantPanelProvider>
    </CommandBarProvider>
  );
}
