import type { Metadata } from "next";
import { prisma, type Prisma } from "@/lib/db";
import { getStore } from "@/lib/storefront/data";
import { toNumber } from "@/lib/money";
import { ProductCard, gridClass } from "@/components/storefront/primitives";
import { StorefrontFilters } from "@/components/storefront/filters";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Shop" };

const SORTS: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  featured: { createdAt: "desc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
  title: { title: "asc" },
};

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { storeSlug } = await params;
  const query = await searchParams;
  const store = await getStore(storeSlug);
  const col = store.theme.collection;

  const where: Prisma.ProductWhereInput = { storeId: store.id, status: "ACTIVE" };
  if (query.category) where.category = { slug: query.category };
  if (query.availability === "in") where.inventory = { gt: 0 };
  const min = query.minPrice ? Number(query.minPrice) : undefined;
  const max = query.maxPrice ? Number(query.maxPrice) : undefined;
  if (Number.isFinite(min) || Number.isFinite(max)) {
    where.price = {
      ...(Number.isFinite(min) ? { gte: min } : {}),
      ...(Number.isFinite(max) ? { lte: max } : {}),
    };
  }

  const [products, categories, priceRange] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: SORTS[query.sort ?? "featured"] ?? SORTS.featured,
      take: 48,
      select: {
        id: true, slug: true, title: true, price: true, compareAtPrice: true,
        inventory: true, trackInventory: true,
        images: { orderBy: { position: "asc" }, take: 2, select: { url: true } },
      },
    }),
    prisma.category.findMany({
      where: { storeId: store.id, products: { some: { status: "ACTIVE" } } },
      select: { name: true, slug: true, _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.product.aggregate({
      where: { storeId: store.id, status: "ACTIVE" },
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  const cards = products.map((product) => ({
    id: product.id,
    slug: product.slug,
    title: product.title,
    price: toNumber(product.price),
    compareAtPrice: product.compareAtPrice ? toNumber(product.compareAtPrice) : null,
    imageUrl: product.images[0]?.url ?? null,
    secondaryImageUrl: product.images[1]?.url ?? null,
    inStock: !product.trackInventory || product.inventory > 0,
    rating: null,
    reviewCount: 0,
  }));

  // With a filter sidebar the grid has less room, so it drops one column.
  const columns = col.showFilters ? Math.max(2, col.columns - 1) : col.columns;
  const grid = (
    <div className={gridClass(columns, col.mobileColumns)} style={{ "--st-image-ratio": `var(--st-collection-ratio, var(--st-image-ratio))` } as React.CSSProperties}>
      {cards.map((product) => (
        <ProductCard key={product.id} product={product} storeSlug={storeSlug} currency={store.currency} showRating={store.theme.cards.showRating} priceEmphasis={store.theme.cards.priceEmphasis} />
      ))}
    </div>
  );

  return (
    <div className="mx-auto px-5 py-10 sm:px-7" style={{ maxWidth: "var(--st-max-width)" }}>
      <header className={cn("mb-7", col.hero === "none" && "sr-only")}>
        <h1 className="st-heading-transform st-h-md">Shop</h1>
        {col.showCount && <p className="st-muted mt-1 text-[13.5px]">{products.length} product{products.length === 1 ? "" : "s"}</p>}
      </header>

      <div className={cn("grid gap-8", col.showFilters && "lg:grid-cols-[200px_1fr]")}>
        {col.showFilters && (
          <StorefrontFilters
            categories={categories.map((category) => ({ slug: category.slug, name: category.name, count: category._count.products }))}
            minPrice={Math.floor(toNumber(priceRange._min.price))}
            maxPrice={Math.ceil(toNumber(priceRange._max.price))}
            currency={store.currency}
          />
        )}
        <div>
          {cards.length === 0 ? (
            <p className="st-radius st-muted border border-dashed px-4 py-16 text-center text-[14px]" style={{ borderColor: "var(--st-border-strong)" }}>
              No products match these filters.
            </p>
          ) : grid}
        </div>
      </div>
    </div>
  );
}
