import type { Metadata } from "next";
import { Suspense } from "react";
import { getStore } from "@/lib/storefront/data";
import { getCartView } from "@/lib/services/cart";
import { getStorefrontSessionId } from "@/lib/storefront/session";
import { StorefrontHeader } from "@/components/storefront/header";
import { StorefrontFooter } from "@/components/storefront/footer";
import { StorefrontAnalytics } from "@/components/storefront/analytics";
import { CartProvider } from "@/components/storefront/cart-provider";
import { googleFontsHref } from "@/lib/storefront/theme";

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
  const fontsHref = googleFontsHref(store.theme);

  return (
    <div
      data-motion={store.theme.motion}
      data-card={store.theme.cardStyle}
      data-header={store.theme.header}
      className="st-root flex min-h-dvh flex-col"
      style={
        {
          "--store-primary": store.primaryColor,
          "--store-secondary": store.secondaryColor,
          ...store.theme.vars,
        } as React.CSSProperties
      }
    >
      {/* Per-store type: only the families this store's theme actually uses.
          React 19 hoists these <link> tags into <head>. */}
      {fontsHref && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={fontsHref} />
        </>
      )}
      <Suspense>
        <StorefrontAnalytics storeSlug={storeSlug} sessionId={sessionId}>
          <CartProvider storeSlug={storeSlug} initialCart={cart}>
            <StorefrontHeader store={store} />
            {store.status === "DRAFT" ? (
              <div
                role="status"
                className="border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-center text-[13px] text-sky-900"
              >
                Draft preview — only you can see this store. Set it live from Store settings
                when you&apos;re ready to share it.
              </div>
            ) : store.status !== "ACTIVE" ? (
              <div
                role="status"
                className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-[13px] text-amber-900"
              >
                {store.name} is not accepting orders at the moment. You can still browse —
                checkout will reopen when the store does.
              </div>
            ) : null}
            <main className="flex-1">{children}</main>
            <StorefrontFooter store={store} />
          </CartProvider>
        </StorefrontAnalytics>
      </Suspense>
    </div>
  );
}
