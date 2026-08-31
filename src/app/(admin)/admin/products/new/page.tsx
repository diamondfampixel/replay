import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { ProductForm } from "@/components/admin/product-form";
import { EMPTY_PRODUCT } from "@/lib/form-defaults";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const ctx = await requireCapability("catalog:write");

  const [categories, collections, store] = await Promise.all([
    prisma.category.findMany({ where: { storeId: ctx.storeId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.collection.findMany({
      where: { storeId: ctx.storeId, type: "MANUAL" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
  ]);

  return (
    <ProductForm
      initial={EMPTY_PRODUCT}
      categories={categories}
      collections={collections}
      currency={store.currency}
      canWrite
    />
  );
}
