import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStore } from "@/lib/storefront/data";
import { getCollectionProducts } from "@/lib/services/collections";
import { toNumber } from "@/lib/money";
import { ProductCard, gridClass } from "@/components/storefront/primitives";
import { StorefrontAnalytics } from "@/components/storefront/analytics";
import { Media } from "@/components/storefront/media";

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
  const col = store.theme.collection;

  const collection = await prisma.collection.findFirst({
    where: { storeId: store.id, slug, visible: true },
  });
  if (!collection) notFound();

  const products = await getCollectionProducts(store.id, collection, { onlyActive: true, limit: 48 });
  const count = col.showCount && (
    <p className="st-muted mt-2 text-[13px]">{products.length} product{products.length === 1 ? "" : "s"}</p>
  );

  return (
    <>
      <StorefrontAnalytics storeSlug={storeSlug} type="collection_view" collectionId={collection.id} />
      {col.hero === "banner" && collection.imageUrl && (
        <div className="relative min-h-[40vh] overflow-hidden" style={{ background: "var(--st-contrast-bg)" }}>
          <Media media={{ url: collection.imageUrl, alt: "", focalX: 50, focalY: 50, overlay: 45, mobileUrl: null }} fill lazy={false} />
          <div className="relative mx-auto flex min-h-[40vh] flex-col justify-end px-5 py-10 text-white sm:px-7" style={{ maxWidth: "var(--st-max-width)" }}>
            <h1 className="st-heading-transform st-h-xl max-w-2xl">{collection.title}</h1>
            {collection.description && <p className="st-lead mt-3 max-w-xl" style={{ color: "rgba(255,255,255,0.86)" }}>{collection.description}</p>}
          </div>
        </div>
      )}
      <div className="mx-auto px-5 py-10 sm:px-7" style={{ maxWidth: "var(--st-max-width)" }}>
        {col.hero === "banner" && collection.imageUrl ? (
          <div className="mb-8">{count}</div>
        ) : col.hero === "none" ? (
          <header className="mb-6"><h1 className="sr-only">{collection.title}</h1>{count}</header>
        ) : (
          <header className="mb-8 max-w-2xl">
            <h1 className="st-heading-transform st-h-lg">{collection.title}</h1>
            {collection.description && <p className="st-muted st-lead mt-3">{collection.description}</p>}
            {count}
          </header>
        )}

        {products.length === 0 ? (
          <p className="st-radius st-muted border border-dashed px-4 py-16 text-center text-[14px]" style={{ borderColor: "var(--st-border-strong)" }}>
            Nothing in this collection yet.
          </p>
        ) : (
          <div className={gridClass(col.columns, col.mobileColumns)} style={{ "--st-image-ratio": "var(--st-collection-ratio, var(--st-image-ratio))" } as React.CSSProperties}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                storeSlug={storeSlug}
                currency={store.currency}
                showRating={store.theme.cards.showRating}
                priceEmphasis={store.theme.cards.priceEmphasis}
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
