import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getProductCards, getStore } from "@/lib/storefront/data";
import { getStorefrontSessionId } from "@/lib/storefront/session";
import { resolveExperiments } from "@/lib/storefront/experiments";
import { toNumber } from "@/lib/money";
import { ProductDetail } from "@/components/storefront/product-detail";
import { formatMoney } from "@/lib/money";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string; slug: string }>;
}): Promise<Metadata> {
  const { storeSlug, slug } = await params;
  const store = await getStore(storeSlug);
  const product = await prisma.product.findFirst({
    where: { storeId: store.id, slug, status: "ACTIVE" },
    select: { title: true, seoTitle: true, seoDescription: true, description: true, images: { take: 1, orderBy: { position: "asc" } } },
  });
  if (!product) return { title: "Product not found" };
  return {
    title: product.seoTitle ?? product.title,
    description: product.seoDescription ?? product.description?.slice(0, 155) ?? undefined,
    openGraph: product.images[0] ? { images: [product.images[0].url] } : undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ storeSlug: string; slug: string }>;
}) {
  const { storeSlug, slug } = await params;
  const store = await getStore(storeSlug);

  const product = await prisma.product.findFirst({
    where: { storeId: store.id, slug, status: "ACTIVE" },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" } },
      category: { select: { name: true, slug: true } },
    },
  });
  if (!product) notFound();

  const sessionId = await getStorefrontSessionId();
  const assignments = await resolveExperiments(store.id, { productId: product.id }, sessionId);

  // Apply any running product experiment before render.
  let title = product.title;
  let description = product.description;
  let priceNote: string | null = null;
  let ctaLabel = "Add to cart";
  let heroImage = product.images[0]?.url ?? null;

  for (const assignment of assignments) {
    const changes = assignment.changes as Record<string, unknown>;
    if (typeof changes.title === "string") title = changes.title;
    if (typeof changes.description === "string") description = changes.description;
    if (typeof changes.priceNote === "string") priceNote = changes.priceNote;
    if (typeof changes.ctaLabel === "string") ctaLabel = changes.ctaLabel;
    if (typeof changes.imageUrl === "string") heroImage = changes.imageUrl;
  }

  const [reviews, ratingAggregate, distribution, recommended, settings] = await Promise.all([
    prisma.review.findMany({
      where: { productId: product.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.review.aggregate({
      where: { productId: product.id, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { productId: product.id, status: "PUBLISHED" },
      _count: true,
    }),
    getProductCards(store.id, {
      source: product.categoryId ? "newest" : "bestsellers",
      limit: 5,
    }),
    prisma.storeSettings.findUnique({ where: { storeId: store.id }, select: { freeShippingThreshold: true } }),
  ]);

  // Trust claims are never invented: the theme's own items win, otherwise the
  // one thing the platform actually enforces (the free-shipping threshold).
  const trustItems = store.theme.product.trustItems.length
    ? store.theme.product.trustItems.map((item) => item.text).filter(Boolean)
    : settings?.freeShippingThreshold
      ? [`Free shipping on orders over ${formatMoney(toNumber(settings.freeShippingThreshold), store.currency)}`]
      : [];

  const images = heroImage && heroImage !== product.images[0]?.url
    ? [{ id: "variant-hero", url: heroImage, alt: title, position: -1 }, ...product.images]
    : product.images;

  return (
    <ProductDetail
      storeSlug={storeSlug}
      currency={store.currency}
      product={{
        id: product.id,
        slug: product.slug,
        title,
        description,
        price: toNumber(product.price),
        compareAtPrice: product.compareAtPrice ? toNumber(product.compareAtPrice) : null,
        inventory: product.inventory,
        trackInventory: product.trackInventory,
        vendor: product.vendor,
        tags: product.tags,
        categoryName: product.category?.name ?? null,
        images: images.map((image) => ({ url: image.url, alt: image.alt ?? title })),
        variants: product.variants.map((variant) => ({
          id: variant.id,
          title: variant.title,
          options: (variant.options ?? {}) as Record<string, string>,
          price: variant.price ? toNumber(variant.price) : null,
          inventory: variant.inventory,
          imageUrl: variant.imageUrl,
        })),
      }}
      ctaLabel={ctaLabel}
      priceNote={priceNote}
      rating={ratingAggregate._avg.rating}
      reviewCount={ratingAggregate._count._all}
      ratingDistribution={distribution.map((row) => ({ rating: row.rating, count: row._count }))}
      reviews={reviews.map((review) => ({
        id: review.id,
        authorName: review.authorName,
        rating: review.rating,
        title: review.title,
        body: review.body,
        verified: review.verified,
        createdAt: review.createdAt.toISOString(),
      }))}
      recommended={recommended.filter((item) => item.id !== product.id).slice(0, 4)}
      design={{ ...store.theme.product, cards: store.theme.cards }}
      trustItems={trustItems}
    />
  );
}
