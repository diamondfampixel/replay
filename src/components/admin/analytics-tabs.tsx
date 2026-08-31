"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/analytics", label: "Overview" },
  { href: "/admin/analytics/sales", label: "Sales" },
  { href: "/admin/analytics/products", label: "Products" },
  { href: "/admin/analytics/customers", label: "Customers" },
  { href: "/admin/analytics/traffic", label: "Traffic" },
  { href: "/admin/analytics/conversion", label: "Conversion" },
];

export function AnalyticsTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();

  return (
    <nav className="flex gap-0.5 overflow-x-auto border-b border-ink-200 scroll-thin" aria-label="Analytics sections">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={query ? `${tab.href}?${query}` : tab.href}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "border-ink-900 text-ink-900"
                : "border-transparent text-ink-500 hover:text-ink-800",
            )}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
