import { Suspense } from "react";
import type { StorefrontStore } from "@/lib/storefront/data";
import { getCartView } from "@/lib/services/cart";
import { getStorefrontSessionId } from "@/lib/storefront/session";
import { StorefrontHeader } from "@/components/storefront/header";
import { StorefrontFooter } from "@/components/storefront/footer";
import { StorefrontAnalytics } from "@/components/storefront/analytics";
import { CartProvider } from "@/components/storefront/cart-provider";
import { RevealObserver } from "@/components/storefront/motion";
import { googleFontsHref } from "@/lib/storefront/theme";

/**
 * The storefront chrome: theme tokens on the root, per-store fonts, header,
 * status banners, footer. Shared by the live storefront layout and the
 * admin-only theme preview, which passes a store whose theme was swapped.
 */
export async function StorefrontFrame({ store, children, banner }: { store: StorefrontStore; children: React.ReactNode; banner?: React.ReactNode }) {
  const [cart, sessionId] = await Promise.all([getCartView(store.id), getStorefrontSessionId()]);
  const fontsHref = googleFontsHref(store.theme);
  const { theme } = store;

  return (
    <div
      data-motion={theme.motion}
      data-card={theme.cardStyle}
      data-card-hover={theme.cards.hover}
      data-card-align={theme.cards.align}
      data-btn-hover={theme.buttons.hover}
      data-header={theme.header.style}
      data-nav-upper={theme.header.navUppercase ? "true" : undefined}
      className="st-root flex min-h-dvh flex-col"
      style={{ "--store-primary": store.primaryColor, "--store-secondary": store.secondaryColor, ...theme.vars } as React.CSSProperties}
    >
      {fontsHref && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={fontsHref} />
        </>
      )}
      {theme.customCss && <style dangerouslySetInnerHTML={{ __html: theme.customCss }} />}
      <RevealObserver />
      <Suspense>
        <StorefrontAnalytics storeSlug={store.slug} sessionId={sessionId}>
          <CartProvider storeSlug={store.slug} initialCart={cart}>
            {banner}
            <StorefrontHeader store={store} />
            {store.status === "DRAFT" ? (
              <div role="status" className="relative z-50 border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-center text-[13px] text-sky-900">
                Draft preview — only you can see this store. Set it live from Store settings when you&apos;re ready to share it.
              </div>
            ) : store.status !== "ACTIVE" ? (
              <div role="status" className="relative z-50 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-[13px] text-amber-900">
                {store.name} is not accepting orders at the moment. You can still browse — checkout will reopen when the store does.
              </div>
            ) : null}
            <main className="st-main flex-1">{children}</main>
            <StorefrontFooter store={store} />
          </CartProvider>
        </StorefrontAnalytics>
      </Suspense>
    </div>
  );
}
