import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { serviceContext, NotFoundError } from "@/lib/services/context";
import { getDiscount, parseAppliesTo, type BxgyConfig } from "@/lib/services/discounts";
import { can } from "@/lib/permissions";
import { toNumber } from "@/lib/money";
import { DiscountForm, type DiscountFormValues } from "@/components/admin/discount-form";

export const metadata: Metadata = { title: "Discount" };
export const dynamic = "force-dynamic";

function toLocalInput(date: Date | null) {
  if (!date) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default async function DiscountPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("marketing:read");
  const ctx = await serviceContext();
  const { id } = await params;

  let discount;
  try {
    discount = await getDiscount(ctx, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [products, collections, store] = await Promise.all([
    prisma.product.findMany({ where: { storeId: ctx.storeId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.collection.findMany({ where: { storeId: ctx.storeId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
  ]);

  const appliesTo = parseAppliesTo(discount.appliesTo);
  const bxgy = (discount.bxgyConfig ?? {}) as Partial<BxgyConfig>;

  const initial: DiscountFormValues = {
    title: discount.title,
    code: discount.code ?? "",
    automatic: discount.automatic,
    type: discount.type,
    status: discount.status,
    value: String(toNumber(discount.value)),
    minPurchase: discount.minPurchase ? String(toNumber(discount.minPurchase)) : "",
    minQuantity: discount.minQuantity ? String(discount.minQuantity) : "",
    usageLimit: discount.usageLimit ? String(discount.usageLimit) : "",
    oncePerCustomer: discount.oncePerCustomer,
    appliesToScope: appliesTo.scope,
    productIds: appliesTo.productIds ?? [],
    collectionIds: appliesTo.collectionIds ?? [],
    buyQuantity: String(bxgy.buyQuantity ?? 2),
    getQuantity: String(bxgy.getQuantity ?? 1),
    getDiscountPercent: String(bxgy.getDiscountPercent ?? 100),
    startsAt: toLocalInput(discount.startsAt),
    endsAt: toLocalInput(discount.endsAt),
  };

  return (
    <DiscountForm
      discountId={discount.id}
      initial={initial}
      products={products}
      collections={collections}
      currency={store.currency}
      usageCount={discount.usageCount}
      canWrite={can(auth.role, "marketing:write")}
    />
  );
}
