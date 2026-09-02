"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { can } from "@/lib/permissions";
import { SETTINGS_NAV } from "@/lib/nav";
import type { Role } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

export function SettingsNav({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav className="scroll-thin -mx-1 flex gap-1 overflow-x-auto pb-2 lg:mx-0 lg:block lg:space-y-5 lg:overflow-visible lg:pb-0">
      {SETTINGS_NAV.map((group) => {
        const items = group.items.filter((item) => !item.capability || can(role, item.capability));
        if (!items.length) return null;
        return (
          <div key={group.label} className="contents lg:block">
            <p className="mb-1.5 hidden px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400 lg:block">
              {group.label}
            </p>
            <ul className="contents lg:block lg:space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      className={cn(
                        "block whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-ink-900 font-medium text-white"
                          : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
