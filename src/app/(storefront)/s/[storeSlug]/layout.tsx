import type { Metadata } from "next";
import { Suspense } from "react";
import { getStore } from "@/lib/storefront/data";
import { getCartView } from "@/lib/services/cart";
import { getStorefrontSessionId } from "@/lib/storefront/session";
import { StorefrontHeader } from "@/components/storefront/header";
import { StorefrontFooter } from "@/components/storefront/footer";
import { StorefrontAnalytics } from "@/components/storefront/analytics";
import { CartProvider } from "@/components/storefront/cart-provider";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<Metadata> {
  const { storeSlug } = await params;
  const store = await getStore(storeSlug);
  return {
    title: { default: store.name, template: `%s · ${store.name}` },
    description: store.description ?? undefined,
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getStore(storeSlug);
  const [cart, sessionId] = await Promise.all([getCartView(store.id), getStorefrontSessionId()]);

  return (
    <div
      className="flex min-h-dvh flex-col bg-white"
      style={
        {
          "--store-primary": store.primaryColor,
          "--store-secondary": store.secondaryColor,
        } as React.CSSProperties
      }
    >
      <Suspense>
        <StorefrontAnalytics storeSlug={storeSlug} sessionId={sessionId}>
          <CartProvider storeSlug={storeSlug} initialCart={cart}>
            <StorefrontHeader store={store} />
            <main className="flex-1">{children}</main>
            <StorefrontFooter store={store} />
          </CartProvider>
        </StorefrontAnalytics>
      </Suspense>
    </div>
  );
}
