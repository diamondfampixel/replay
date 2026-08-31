"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { RANGE_PRESETS } from "@/lib/ranges";

export function RangePicker({ current, label }: { current: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");

  function apply(next: Record<string, string | null>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key);
      else search.set(key, value);
    }
    router.push(`${pathname}?${search.toString()}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary">
          <Calendar />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        {Object.entries(RANGE_PRESETS).map(([key, preset]) => (
          <DropdownMenuItem
            key={key}
            onSelect={() => apply({ range: key, from: null, to: null })}
            className={current === key ? "bg-ink-100" : undefined}
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Custom range
          </p>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-7 text-[12px]"
              aria-label="From date"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-7 text-[12px]"
              aria-label="To date"
            />
          </div>
          <Button
            size="sm"
            variant="primary"
            className="mt-2 w-full"
            disabled={!from || !to || from > to}
            onClick={() => apply({ range: "custom", from, to })}
          >
            Apply
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
