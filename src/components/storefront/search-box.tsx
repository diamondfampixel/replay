"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function SearchBox({ storeSlug, initialQuery }: { storeSlug: string; initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialQuery);

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (query.trim()) router.push(`/s/${storeSlug}/search?q=${encodeURIComponent(query.trim())}`);
      }}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products…"
          aria-label="Search products"
          className="h-11 w-full rounded-md border border-ink-200 pl-9 pr-3 text-[14px] outline-none focus:border-ink-400"
        />
      </div>
      <button type="submit" className="h-11 rounded-md bg-ink-900 px-5 text-[14px] font-medium text-white hover:bg-ink-800">
        Search
      </button>
    </form>
  );
}
