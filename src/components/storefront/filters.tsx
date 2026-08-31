"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function StorefrontFilters({
  categories,
  minPrice,
  maxPrice,
  currency,
}: {
  categories: Array<{ slug: string; name: string; count: number }>;
  minPrice: number;
  maxPrice: number;
  currency: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(next: Record<string, string | null>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) search.delete(key);
      else search.set(key, value);
    }
    router.push(`${pathname}?${search.toString()}`);
  }

  const active = params.get("category");
  const buckets = buildBuckets(minPrice, maxPrice);

  return (
    <aside className="space-y-6 text-[13.5px]">
      <div>
        <label htmlFor="sort" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">
          Sort
        </label>
        <select
          id="sort"
          value={params.get("sort") ?? "featured"}
          onChange={(event) => update({ sort: event.target.value })}
          className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-[13px]"
        >
          <option value="featured">Featured</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="title">Alphabetical</option>
        </select>
      </div>

      {categories.length > 0 && (
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Category</h2>
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => update({ category: null })}
                className={cn("text-left hover:text-ink-900", !active ? "font-medium text-ink-900" : "text-ink-600")}
              >
                All products
              </button>
            </li>
            {categories.map((category) => (
              <li key={category.slug}>
                <button
                  type="button"
                  onClick={() => update({ category: category.slug })}
                  className={cn(
                    "text-left hover:text-ink-900",
                    active === category.slug ? "font-medium text-ink-900" : "text-ink-600",
                  )}
                >
                  {category.name}{" "}
                  <span className="tabular text-[12px] text-ink-400">({category.count})</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Price</h2>
        <ul className="space-y-1">
          {buckets.map((bucket) => {
            const isActive =
              params.get("minPrice") === (bucket.min?.toString() ?? null) &&
              params.get("maxPrice") === (bucket.max?.toString() ?? null);
            return (
              <li key={bucket.label}>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      minPrice: bucket.min !== null ? String(bucket.min) : null,
                      maxPrice: bucket.max !== null ? String(bucket.max) : null,
                    })
                  }
                  className={cn("text-left hover:text-ink-900", isActive ? "font-medium text-ink-900" : "text-ink-600")}
                >
                  {bucket.label}
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => update({ minPrice: null, maxPrice: null })}
              className="text-left text-ink-500 hover:text-ink-900"
            >
              Any price
            </button>
          </li>
        </ul>
        <p className="mt-1.5 text-[12px] text-ink-400">
          {formatMoney(minPrice, currency)} – {formatMoney(maxPrice, currency)}
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Availability</h2>
        <label className="flex cursor-pointer items-center gap-2 text-ink-600">
          <input
            type="checkbox"
            className="size-3.5 accent-[var(--store-primary)]"
            checked={params.get("availability") === "in"}
            onChange={(event) => update({ availability: event.target.checked ? "in" : null })}
          />
          In stock only
        </label>
      </div>
    </aside>
  );
}

function buildBuckets(min: number, max: number) {
  if (max <= min) return [];
  const step = Math.max(10, Math.ceil((max - min) / 4 / 10) * 10);
  const buckets: Array<{ label: string; min: number | null; max: number | null }> = [];
  for (let start = 0; start < max; start += step) {
    const end = start + step;
    buckets.push({
      label: `$${start} – $${end}`,
      min: start,
      max: end >= max ? null : end,
    });
    if (buckets.length >= 4) break;
  }
  return buckets;
}
