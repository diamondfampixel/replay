"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, PanelLeftClose, PanelLeft, Search } from "lucide-react";
import { Wordmark, Logomark } from "@/components/brand";
import { NavIcon } from "@/components/admin/icon";
import { ADMIN_NAV, PLATFORM_NAV, type NavGroup } from "@/lib/nav";
import { can, type Capability } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import { useCommandBar } from "@/components/admin/command-bar";
import { useIsMac } from "@/lib/client-state";

export function Sidebar({
  role,
  platformAdmin = false,
  storeSlug,
  storeName,
  collapsed,
  onToggle,
  onNavigate,
}: {
  role: Role;
  platformAdmin?: boolean;
  storeSlug: string;
  storeName: string;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const commandBar = useCommandBar();
  const mac = useIsMac();

  return (
    <div className="flex h-full flex-col bg-white">
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-ink-200",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        <Link href="/admin" onClick={onNavigate} className="min-w-0">
          {collapsed ? <Logomark /> : <Wordmark />}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="hidden rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 lg:block"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          className="mx-auto mt-2 rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          aria-label="Expand sidebar"
        >
          <PanelLeft className="size-4" />
        </button>
      )}

      <div className={cn("px-3 pt-3", collapsed && "px-2")}>
        <button
          type="button"
          onClick={() => commandBar.open()}
          className={cn(
            "flex w-full items-center gap-2 rounded-md border border-ink-200 bg-ink-50 text-[13px] text-ink-500 transition-colors hover:bg-ink-100",
            collapsed ? "h-8 justify-center px-0" : "h-8 px-2.5",
          )}
          aria-label="Open command bar"
        >
          <Search className="size-3.5 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search or ask AI</span>
              <kbd className="rounded border border-ink-300 bg-white px-1 py-px text-[10px] font-medium text-ink-500">
                {mac ? "⌘" : "Ctrl"}K
              </kbd>
            </>
          )}
        </button>
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
        {[...ADMIN_NAV, ...(platformAdmin ? PLATFORM_NAV : [])].map((group: NavGroup, groupIndex: number) => {
          const items = group.items.filter(
            (item) => !item.capability || can(role, item.capability as Capability),
          );
          if (!items.length) return null;
          return (
            <div key={groupIndex} className={cn(groupIndex > 0 && "mt-5")}>
              {group.label && !collapsed && (
                <p className="mb-1.5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
                          collapsed ? "justify-center px-0 py-2" : "px-2 py-1.5",
                          active
                            ? "bg-ink-900 text-white"
                            : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <NavIcon
                          name={item.icon}
                          className={cn("size-4 shrink-0", active ? "text-white" : "text-ink-400")}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t border-ink-200 p-3", collapsed && "px-2")}>
        <a
          href={`/s/${storeSlug}`}
          target="_blank"
          rel="noreferrer"
          title={collapsed ? "View store" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-md border border-ink-200 text-[13px] font-medium text-ink-700 transition-colors hover:bg-ink-50",
            collapsed ? "justify-center py-2" : "px-2.5 py-2",
          )}
        >
          <ExternalLink className="size-3.5 shrink-0 text-ink-400" />
          {!collapsed && <span className="truncate">View {storeName}</span>}
        </a>
      </div>
    </div>
  );
}
