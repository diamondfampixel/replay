import type { Metadata } from "next";
import { prisma, type Prisma } from "@/lib/db";
import { getStore } from "@/lib/storefront/data";
import { toNumber } from "@/lib/money";
import { ProductCard } from "@/components/storefront/primitives";
import { SearchBox } from "@/components/storefront/search-box";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { storeSlug } = await params;
  const query = await searchParams;
  const store = await getStore(storeSlug);
  const q = (query.q ?? "").trim();

  let products: Array<{
    id: string; slug: string; title: string; price: unknown; compareAtPrice: unknown;
    inventory: number; trackInventory: boolean; images: Array<{ url: string }>;
  }> = [];

  if (q) {
    const contains = { contains: q, mode: "insensitive" as const };
    const where: Prisma.ProductWhereInput = {
      storeId: store.id,
      status: "ACTIVE",
      OR: [
        { title: contains },
        { description: contains },
        { tags: { has: q.toLowerCase() } },
        { category: { name: contains } },
        { vendor: contains },
      ],
    };
    if (query.availability === "in") where.inventory = { gt: 0 };

    products = await prisma.product.findMany({
      where,
      take: 40,
      orderBy: { title: "asc" },
      select: {
        id: true, slug: true, title: true, price: true, compareAtPrice: true,
        inventory: true, trackInventory: true,
        images: { orderBy: { position: "asc" }, take: 2, select: { url: true } },
      },
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink-900">Search</h1>
      <div className="mt-5 max-w-lg">
        <SearchBox storeSlug={storeSlug} initialQuery={q} />
      </div>

      {q && (
        <p className="mt-5 text-[13.5px] text-ink-500">
          {products.length} result{products.length === 1 ? "" : "s"} for “{q}”
        </p>
      )}

      {q && products.length === 0 && (
        <p className="mt-6 rounded-md border border-dashed border-ink-300 px-4 py-16 text-center text-[14px] text-ink-500">
          Nothing matched. Try a different word, or browse the{" "}
          <a href={`/s/${storeSlug}/shop`} className="text-ink-800 underline">full range</a>.
        </p>
      )}

      {products.length > 0 && (
        <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              storeSlug={storeSlug}
              currency={store.currency}
              product={{
                id: product.id,
                slug: product.slug,
                title: product.title,
                price: toNumber(product.price as never),
                compareAtPrice: product.compareAtPrice ? toNumber(product.compareAtPrice as never) : null,
                imageUrl: product.images[0]?.url ?? null,
                secondaryImageUrl: product.images[1]?.url ?? null,
                inStock: !product.trackInventory || product.inventory > 0,
                rating: null,
                reviewCount: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
