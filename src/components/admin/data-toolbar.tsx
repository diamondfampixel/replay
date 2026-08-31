"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FilterDef = {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
};

/**
 * Search + filter + sort controls that write to the URL, so every list view is
 * shareable, bookmarkable and server-rendered from its query string.
 */
export function DataToolbar({
  searchPlaceholder = "Search…",
  filters = [],
  sortOptions,
  children,
}: {
  searchPlaceholder?: string;
  filters?: FilterDef[];
  sortOptions?: Array<{ value: string; label: string }>;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");

  useEffect(() => setQuery(params.get("q") ?? ""), [params]);

  function update(next: Record<string, string | null>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) search.delete(key);
      else search.set(key, value);
    }
    search.delete("page");
    startTransition(() => router.push(`${pathname}?${search.toString()}`));
  }

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (query === current) return;
    const timer = setTimeout(() => update({ q: query || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const activeFilters = filters.filter((filter) => params.get(filter.key));
  const hasFilters = activeFilters.length > 0 || Boolean(params.get("q"));

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 px-3 py-2.5">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 pl-8 text-[13px]"
          aria-label="Search"
        />
      </div>

      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={params.get(filter.key) ?? ""}
          onChange={(event) => update({ [filter.key]: event.target.value || null })}
          className={cn("h-8 w-auto min-w-[110px] text-[13px]", params.get(filter.key) && "border-ink-400")}
          aria-label={filter.label}
        >
          <option value="">{filter.label}</option>
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      ))}

      {sortOptions && (
        <Select
          value={params.get("sort") ?? sortOptions[0]?.value}
          onChange={(event) => update({ sort: event.target.value })}
          className="h-8 w-auto min-w-[130px] text-[13px]"
          aria-label="Sort"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      )}

      {hasFilters && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setQuery("");
            startTransition(() => router.push(pathname));
          }}
        >
          <X />
          Clear
        </Button>
      )}

      {children}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  perPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function goto(next: number) {
    const search = new URLSearchParams(params.toString());
    search.set("page", String(next));
    router.push(`${pathname}?${search.toString()}`);
  }

  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink-200 px-3 py-2.5">
      <p className="tabular text-[12.5px] text-ink-500">
        {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => goto(page - 1)}>
          Previous
        </Button>
        <span className="tabular px-1.5 text-[12.5px] text-ink-500">
          {page} / {pageCount}
        </span>
        <Button size="sm" variant="secondary" disabled={page >= pageCount} onClick={() => goto(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
