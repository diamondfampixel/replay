"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Sparkles, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { initialsOf, cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";
import { logoutAction } from "@/app/actions/auth";
import { markNotificationsReadAction } from "@/app/actions/notifications";
import { useAssistantPanel } from "@/components/admin/assistant-panel";

export type TopbarNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export function Topbar({
  user,
  organizationName,
  storeName,
  role,
  notifications,
  onOpenMobileNav,
}: {
  user: { name: string; email: string };
  organizationName: string;
  storeName: string;
  role: Role;
  notifications: TopbarNotification[];
  onOpenMobileNav: () => void;
}) {
  const router = useRouter();
  const assistant = useAssistantPanel();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(notifications);
  const unread = items.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 bg-white/95 px-4 backdrop-blur">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="rounded p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-4.5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink-800">{storeName}</p>
        {organizationName !== storeName && (
          <p className="truncate text-[11.5px] text-ink-500">{organizationName}</p>
        )}
      </div>

      <Button
        size="sm"
        variant="secondary"
        onClick={() => assistant.open()}
        className="hidden sm:inline-flex"
      >
        <Sparkles className="text-pine-600" />
        Ask AI
      </Button>

      <DropdownMenu
        onOpenChange={(open) => {
          if (!open || unread === 0) return;
          setItems((prev) => prev.map((n) => ({ ...n, read: true })));
          startTransition(async () => {
            await markNotificationsReadAction();
            router.refresh();
          });
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative rounded p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
          >
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--color-signal-negative)] text-[9px] font-semibold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 p-0">
          <div className="flex items-center justify-between border-b border-ink-200 px-3 py-2">
            <p className="text-[13px] font-semibold text-ink-900">Notifications</p>
            {unread > 0 && <Badge tone="info">{unread} new</Badge>}
          </div>
          <div className="scroll-thin max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-ink-500">Nothing yet.</p>
            ) : (
              items.map((notification) => {
                const content = (
                  <div
                    className={cn(
                      "border-b border-ink-100 px-3 py-2.5 last:border-0",
                      !notification.read && "bg-pine-50/40",
                    )}
                  >
                    <p className="text-[13px] font-medium text-ink-800">{notification.title}</p>
                    {notification.body && (
                      <p className="mt-0.5 text-[12px] text-ink-500">{notification.body}</p>
                    )}
                    <p className="mt-1 text-[11px] text-ink-400">
                      {new Date(notification.createdAt).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </p>
                  </div>
                );
                return notification.href ? (
                  <Link key={notification.id} href={notification.href} className="block hover:bg-ink-50">
                    {content}
                  </Link>
                ) : (
                  <div key={notification.id}>{content}</div>
                );
              })
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-ink-100"
            aria-label="Account menu"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-ink-900 text-[11px] font-semibold text-white">
              {initialsOf(user.name)}
            </span>
            <ChevronDown className="size-3.5 text-ink-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
          <div className="px-2 pb-2">
            <p className="truncate text-[13px] font-medium text-ink-900">{user.name}</p>
            <p className="truncate text-[12px] text-ink-500">{user.email}</p>
            <Badge tone="outline" className="mt-1.5">{ROLE_LABELS[role]}</Badge>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/admin/settings/profile">
              <UserIcon />
              Profile & account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onSelect={() => startTransition(async () => { await logoutAction(); })}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
