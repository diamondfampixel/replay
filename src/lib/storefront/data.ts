import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { getActiveContext } from "@/lib/session";
import { toNumber } from "@/lib/money";
import { getCollectionProducts } from "@/lib/services/collections";

export type StorefrontStore = {
  id: string;
  slug: string;
  name: string;
  status: string;
  description: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  contactEmail: string | null;
  isDemo: boolean;
  /** Free-plan storefronts carry a small credit; paid plans remove it. */
  showHalyardCredit: boolean;
  nav: Array<{ label: string; href: string }>;
  footerNav: Array<{ label: string; href: string }>;
};

export const getStore = cache(async (slug: string): Promise<StorefrontStore> => {
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      navigationItems: { orderBy: { position: "asc" } },
      organization: { select: { plan: true } },
    },
  });
  if (!store) notFound();

  // A draft store is the operator's private preview: they see the real
  // storefront (with a draft banner) before setting it live, while the
  // public keeps getting a 404. This is what lets a free account build and
  // preview the whole customer experience before launching.
  if (store.status === "DRAFT") {
    const ctx = await getActiveContext();
    if (ctx?.storeId !== store.id) notFound();
  }

  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    status: store.status,
    description: store.description,
    logoUrl: store.logoUrl,
    primaryColor: store.primaryColor,
    secondaryColor: store.secondaryColor,
    currency: store.currency,
    contactEmail: store.contactEmail,
    isDemo: store.isDemo,
    showHalyardCredit: getPlan(store.organization.plan).limits.halyardBranding,
    nav: store.navigationItems.filter((item) => item.group === "main").map((item) => ({ label: item.label, href: item.href })),
    footerNav: store.navigationItems.filter((item) => item.group === "footer").map((item) => ({ label: item.label, href: item.href })),
  };
});

export type ProductCardData = {
  id: string;
  slug: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  secondaryImageUrl: string | null;
  inStock: boolean;
  rating: number | null;
  reviewCount: number;
};

function toCard(product: {
  id: string; slug: string; title: string; price: unknown; compareAtPrice: unknown;
  inventory: number; trackInventory: boolean;
  images: Array<{ url: string }>;
}): ProductCardData {
  return {
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
  };
}

/** Attaches published-review aggregates to a set of cards in one query. */
async function withRatings(cards: ProductCardData[]): Promise<ProductCardData[]> {
  if (!cards.length) return cards;
  const ratings = await prisma.review.groupBy({
    by: ["productId"],
    where: { productId: { in: cards.map((card) => card.id) }, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const map = new Map(ratings.map((row) => [row.productId, row]));
  return cards.map((card) => {
    const row = map.get(card.id);
    return {
      ...card,
      rating: row?._avg.rating ?? null,
      reviewCount: row?._count._all ?? 0,
    };
  });
}

const CARD_SELECT = {
  id: true, slug: true, title: true, price: true, compareAtPrice: true,
  inventory: true, trackInventory: true,
  images: { orderBy: { position: "asc" as const }, take: 2, select: { url: true } },
};

export async function getProductCards(
  storeId: string,
  options: {
    collectionSlug?: string;
    productIds?: string[];
    source?: "collection" | "manual" | "bestsellers" | "newest";
    limit?: number;
  },
): Promise<ProductCardData[]> {
  const limit = options.limit ?? 4;

  if (options.source === "manual" && options.productIds?.length) {
    const products = await prisma.product.findMany({
      where: { storeId, status: "ACTIVE", id: { in: options.productIds } },
      select: CARD_SELECT,
    });
    const order = new Map(options.productIds.map((id, index) => [id, index]));
    return withRatings(
      products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(toCard),
    );
  }

  if (options.source === "collection" && options.collectionSlug) {
    const collection = await prisma.collection.findFirst({
      where: { storeId, slug: options.collectionSlug, visible: true },
    });
    if (collection) {
      const products = await getCollectionProducts(storeId, collection, { onlyActive: true, limit });
      return withRatings(products.map((product) => toCard(product as never)));
    }
  }

  if (options.source === "bestsellers") {
    const top = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, order: { storeId } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit * 2,
    });
    const ids = top.map((row) => row.productId!).filter(Boolean);
    if (ids.length) {
      const products = await prisma.product.findMany({
        where: { storeId, status: "ACTIVE", id: { in: ids } },
        select: CARD_SELECT,
        take: limit,
      });
      const order = new Map(ids.map((id, index) => [id, index]));
      return withRatings(products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(toCard));
    }
  }

  const products = await prisma.product.findMany({
    where: { storeId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: CARD_SELECT,
  });
  return withRatings(products.map(toCard));
}

export async function getCollectionCards(storeId: string, slugs: string[]) {
  const where = slugs.length
    ? { storeId, visible: true, slug: { in: slugs } }
    : { storeId, visible: true };

  const collections = await prisma.collection.findMany({
    where,
    orderBy: { position: "asc" },
    take: slugs.length ? undefined : 6,
  });

  const ordered = slugs.length
    ? slugs.map((slug) => collections.find((c) => c.slug === slug)).filter(Boolean)
    : collections;

  return Promise.all(
    (ordered as typeof collections).map(async (collection) => ({
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      imageUrl: collection.imageUrl,
      productCount: await (collection.type === "AUTOMATIC"
        ? prisma.product.count({ where: { storeId, status: "ACTIVE" } })
        : prisma.collectionProduct.count({ where: { collectionId: collection.id } })),
    })),
  );
}

export async function getPublishedReviews(storeId: string, limit: number, minRating: number) {
  const reviews = await prisma.review.findMany({
    where: { storeId, status: "PUBLISHED", rating: { gte: minRating } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { product: { select: { title: true, slug: true } } },
  });
  return reviews.map((review) => ({
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    title: review.title,
    body: review.body,
    verified: review.verified,
    createdAt: review.createdAt,
    productTitle: review.product.title,
    productSlug: review.product.slug,
    isDemo: review.isDemo,
  }));
}

export async function getHomepage(storeId: string) {
  return prisma.page.findFirst({
    where: { storeId, type: "HOME" },
    include: { sections: { orderBy: { position: "asc" } } },
  });
}
