import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStore } from "@/lib/storefront/data";
import { getCollectionProducts } from "@/lib/services/collections";
import { toNumber } from "@/lib/money";
import { ProductCard } from "@/components/storefront/primitives";
import { StorefrontAnalytics } from "@/components/storefront/analytics";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string; slug: string }>;
}): Promise<Metadata> {
  const { storeSlug, slug } = await params;
  const store = await getStore(storeSlug);
  const collection = await prisma.collection.findFirst({
    where: { storeId: store.id, slug, visible: true },
    select: { title: true, seoTitle: true, seoDescription: true, description: true },
  });
  if (!collection) return { title: "Collection not found" };
  return {
    title: collection.seoTitle ?? collection.title,
    description: collection.seoDescription ?? collection.description ?? undefined,
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ storeSlug: string; slug: string }>;
}) {
  const { storeSlug, slug } = await params;
  const store = await getStore(storeSlug);

  const collection = await prisma.collection.findFirst({
    where: { storeId: store.id, slug, visible: true },
  });
  if (!collection) notFound();

  const products = await getCollectionProducts(store.id, collection, { onlyActive: true, limit: 48 });

  return (
    <>
      <StorefrontAnalytics storeSlug={storeSlug} type="collection_view" collectionId={collection.id} />
      <div className="mx-auto max-w-6xl px-5 py-10">
        {collection.imageUrl && (
          <div className="mb-8 aspect-[3/1] overflow-hidden rounded-lg bg-ink-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={collection.imageUrl} alt="" className="size-full object-cover" />
          </div>
        )}
        <header className="mb-8 max-w-2xl">
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink-900">{collection.title}</h1>
          {collection.description && (
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-600">{collection.description}</p>
          )}
          <p className="mt-2 text-[13px] text-ink-400">
            {products.length} product{products.length === 1 ? "" : "s"}
          </p>
        </header>

        {products.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-300 px-4 py-16 text-center text-[14px] text-ink-500">
            Nothing in this collection yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                storeSlug={storeSlug}
                currency={store.currency}
                product={{
                  id: product.id,
                  slug: product.slug,
                  title: product.title,
                  price: toNumber(product.price),
                  compareAtPrice: product.compareAtPrice ? toNumber(product.compareAtPrice) : null,
                  imageUrl: product.images?.[0]?.url ?? null,
                  secondaryImageUrl: null,
                  inStock: !product.trackInventory || product.inventory > 0,
                  rating: null,
                  reviewCount: 0,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
