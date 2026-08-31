import type { Metadata } from "next";
import { getStore } from "@/lib/storefront/data";
import { CartPageClient } from "@/components/storefront/cart-page";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  await getStore(storeSlug);
  return <CartPageClient storeSlug={storeSlug} />;
}
