import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { getProduct, getProductStats } from "@/lib/services/products";
import { NotFoundError } from "@/lib/services/context";
import { can } from "@/lib/permissions";
import { toNumber } from "@/lib/money";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "Product" };
export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("catalog:read");
  const ctx = await serviceContext();
  const { id } = await params;

  let product;
  try {
    product = await getProduct(ctx, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [categories, collections, store, stats] = await Promise.all([
    prisma.category.findMany({ where: { storeId: ctx.storeId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.collection.findMany({
      where: { storeId: ctx.storeId, type: "MANUAL" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true, slug: true } }),
    getProductStats(ctx.storeId, id),
  ]);

  // Reconstruct the option axes from the stored variant option maps so the
  // matrix editor opens in the same state it was saved in.
  const axisMap = new Map<string, string[]>();
  for (const variant of product.variants) {
    for (const [name, value] of Object.entries((variant.options ?? {}) as Record<string, string>)) {
      const values = axisMap.get(name) ?? [];
      if (!values.includes(value)) values.push(value);
      axisMap.set(name, values);
    }
  }

  const initial: ProductFormValues = {
    title: product.title,
    slug: product.slug,
    description: product.description ?? "",
    status: product.status,
    price: String(toNumber(product.price)),
    compareAtPrice: product.compareAtPrice ? String(toNumber(product.compareAtPrice)) : "",
    cost: product.cost ? String(toNumber(product.cost)) : "",
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    trackInventory: product.trackInventory,
    inventory: String(product.inventory),
    categoryId: product.categoryId ?? "",
    collectionIds: product.collections.map((link) => link.collection.id),
    vendor: product.vendor ?? "",
    tags: product.tags,
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    images: product.images.map((image) => ({ id: image.id, url: image.url, alt: image.alt })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      options: (variant.options ?? {}) as Record<string, string>,
      sku: variant.sku ?? "",
      price: variant.price ? String(toNumber(variant.price)) : "",
      inventory: String(variant.inventory),
      imageUrl: variant.imageUrl,
    })),
    optionAxes: [...axisMap.entries()].map(([name, values]) => ({ name, values })),
  };

  return (
    <ProductForm
      productId={product.id}
      initial={initial}
      categories={categories}
      collections={collections}
      currency={store.currency}
      storefrontUrl={`/s/${store.slug}/products/${product.slug}`}
      stats={stats}
      canWrite={can(auth.role, "catalog:write")}
    />
  );
}
