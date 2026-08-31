import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { toNumber } from "@/lib/money";
import { CollectionForm, EMPTY_COLLECTION } from "@/components/admin/collection-form";

export const metadata: Metadata = { title: "New collection" };

export default async function NewCollectionPage() {
  const ctx = await requireCapability("catalog:write");
  const [products, store] = await Promise.all([
    prisma.product.findMany({
      where: { storeId: ctx.storeId },
      orderBy: { title: "asc" },
      select: { id: true, title: true, price: true, status: true, images: { take: 1, orderBy: { position: "asc" } } },
    }),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
  ]);

  return (
    <CollectionForm
      initial={EMPTY_COLLECTION}
      allProducts={products.map((product) => ({
        id: product.id,
        title: product.title,
        price: toNumber(product.price),
        status: product.status,
        imageUrl: product.images[0]?.url ?? null,
      }))}
      currency={store.currency}
      canWrite
    />
  );
}
