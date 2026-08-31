import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { DiscountForm, EMPTY_DISCOUNT } from "@/components/admin/discount-form";

export const metadata: Metadata = { title: "New discount" };

export default async function NewDiscountPage() {
  const ctx = await requireCapability("marketing:write");
  const [products, collections, store] = await Promise.all([
    prisma.product.findMany({ where: { storeId: ctx.storeId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.collection.findMany({ where: { storeId: ctx.storeId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
  ]);

  return (
    <DiscountForm
      initial={EMPTY_DISCOUNT}
      products={products}
      collections={collections}
      currency={store.currency}
      canWrite
    />
  );
}
