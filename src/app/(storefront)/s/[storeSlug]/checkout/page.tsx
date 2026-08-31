import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStore } from "@/lib/storefront/data";
import { getCartView } from "@/lib/services/cart";
import { CheckoutForm } from "@/components/storefront/checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getStore(storeSlug);
  const cart = await getCartView(store.id);
  if (!cart.items.length) redirect(`/s/${storeSlug}/cart`);

  const settings = await prisma.storeSettings.findUnique({
    where: { storeId: store.id },
    select: { checkoutMode: true },
  });

  return (
    <CheckoutForm
      storeSlug={storeSlug}
      storeName={store.name}
      checkoutMode={settings?.checkoutMode ?? "simulated"}
      stripeConfigured={Boolean(process.env.STRIPE_SECRET_KEY)}
    />
  );
}
