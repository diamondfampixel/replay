"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/storefront/cart-provider";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import type { StorefrontStore } from "@/lib/storefront/data";

export function StorefrontHeader({ store }: { store: StorefrontStore }) {
  const { cart, setDrawerOpen } = useCart();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const base = `/s/${store.slug}`;

  return (
    <>
      {store.isDemo && (
        <div className="bg-ink-900 px-4 py-1.5 text-center text-[11.5px] text-white/80">
          Demonstration store — orders placed here are simulated and no payment is taken.
        </div>
      )}

      <header
        className="st-header sticky top-0 z-40 border-b backdrop-blur"
        style={{ background: "color-mix(in srgb, var(--st-bg) 92%, transparent)", borderColor: "var(--st-border)" }}
      >
        <div className="st-header-inner mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="st-header-link -ml-1.5 rounded p-1.5 sm:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>

          <Link href={base} className="st-wordmark-link flex items-center gap-2">
            {store.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={store.logoUrl} alt={store.name} className="h-7 w-auto" />
            ) : (
              <span className="st-display st-heading-transform text-[17px]" style={{ color: "var(--st-fg)", fontWeight: "var(--st-heading-weight)" as React.CSSProperties["fontWeight"] }}>
                {store.name}
              </span>
            )}
          </Link>

          <nav className="st-header-nav ml-6 hidden gap-6 text-[13.5px] sm:flex" style={{ color: "var(--st-muted-fg)" }}>
            {store.nav.map((item) => (
              <Link key={item.href} href={`${base}${item.href}`} className="st-header-link transition-colors hover:opacity-70">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="st-header-actions ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen((open) => !open)}
              className="st-header-link rounded p-2"
              aria-label="Search"
              aria-expanded={searchOpen}
            >
              <Search className="size-4.5" />
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="st-header-link relative rounded p-2"
              aria-label={`Cart (${cart.itemCount} items)`}
            >
              <ShoppingBag className="size-4.5" />
              {cart.itemCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{ background: "var(--st-accent)", color: "var(--st-accent-fg)" }}
                >
                  {cart.itemCount > 9 ? "9+" : cart.itemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-ink-200 bg-white px-5 py-3">
            <form
              className="mx-auto flex max-w-6xl gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const query = new FormData(event.currentTarget).get("q");
                if (typeof query === "string" && query.trim()) {
                  router.push(`${base}/search?q=${encodeURIComponent(query.trim())}`);
                  setSearchOpen(false);
                }
              }}
            >
              <input
                name="q"
                autoFocus
                placeholder="Search products…"
                className="h-10 flex-1 rounded-md border border-ink-200 px-3 text-[14px] outline-none focus:border-ink-400"
              />
              <button type="submit" className="h-10 rounded-md bg-ink-900 px-4 text-[13.5px] font-medium text-white">
                Search
              </button>
            </form>
          </div>
        )}
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-ink-950/30" onClick={() => setMenuOpen(false)} />
          <nav className="absolute inset-y-0 left-0 w-72 p-5 shadow-xl" style={{ background: "var(--st-bg)" }}>
            <div className="mb-6 flex items-center justify-between">
              <span className="st-display text-[15px]" style={{ color: "var(--st-fg)", fontWeight: "var(--st-heading-weight)" as React.CSSProperties["fontWeight"] }}>{store.name}</span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="st-header-link rounded p-1">
                <X className="size-4" />
              </button>
            </div>
            <ul className="space-y-1">
              {[{ label: "Home", href: "/" }, ...store.nav].map((item) => (
                <li key={item.href}>
                  <Link
                    href={`${base}${item.href === "/" ? "" : item.href}`}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-md px-3 py-2.5 text-[14.5px] hover:opacity-70"
                    style={{ color: "var(--st-fg)" }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}

      <CartDrawer store={store} />
    </>
  );
}
