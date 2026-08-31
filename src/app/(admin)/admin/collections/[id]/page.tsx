import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { serviceContext, NotFoundError } from "@/lib/services/context";
import { getCollection, getCollectionProducts, parseRules } from "@/lib/services/collections";
import { can } from "@/lib/permissions";
import { toNumber } from "@/lib/money";
import { CollectionForm, type CollectionFormValues, type PickerProduct } from "@/components/admin/collection-form";

export const metadata: Metadata = { title: "Collection" };
export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("catalog:read");
  const ctx = await serviceContext();
  const { id } = await params;

  let collection;
  try {
    collection = await getCollection(ctx, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [products, store, matched] = await Promise.all([
    prisma.product.findMany({
      where: { storeId: ctx.storeId },
      orderBy: { title: "asc" },
      select: { id: true, title: true, price: true, status: true, images: { take: 1, orderBy: { position: "asc" } } },
    }),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true, slug: true } }),
    collection.type === "AUTOMATIC"
      ? getCollectionProducts(ctx.storeId, collection)
      : Promise.resolve([]),
  ]);

  const toPicker = (product: {
    id: string; title: string; price: unknown; status: string;
    images: Array<{ url: string }>;
  }): PickerProduct => ({
    id: product.id,
    title: product.title,
    price: toNumber(product.price as never),
    status: product.status,
    imageUrl: product.images[0]?.url ?? null,
  });

  const rules = parseRules(collection.rules);

  const initial: CollectionFormValues = {
    title: collection.title,
    slug: collection.slug,
    description: collection.description ?? "",
    imageUrl: collection.imageUrl,
    type: collection.type,
    match: rules.match,
    rules: rules.rules,
    productIds: collection.products.map((link) => link.productId),
    visible: collection.visible,
    seoTitle: collection.seoTitle ?? "",
    seoDescription: collection.seoDescription ?? "",
  };

  return (
    <CollectionForm
      collectionId={collection.id}
      initial={initial}
      allProducts={products.map(toPicker)}
      matchedProducts={matched.map((product) => toPicker(product as never))}
      currency={store.currency}
      storefrontUrl={`/s/${store.slug}/collections/${collection.slug}`}
      canWrite={can(auth.role, "catalog:write")}
    />
  );
}
