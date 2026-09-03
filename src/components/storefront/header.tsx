"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/storefront/cart-provider";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import type { StorefrontStore } from "@/lib/storefront/data";
import { cn } from "@/lib/utils";

const LOGO_H: Record<string, string> = { sm: "h-6", md: "h-7", lg: "h-9" };
const WORD_SIZE: Record<string, string> = { sm: "text-[15px]", md: "text-[17px]", lg: "text-[21px]" };

/**
 * Store header with five compositions (classic / centered / split / minimal /
 * transparent) driven by the theme's header config. Layout rules live in CSS
 * keyed on `data-header`; this component only decides what to render where.
 */
export function StorefrontHeader({ store }: { store: StorefrontStore }) {
  const { cart, setDrawerOpen } = useCart();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const base = `/s/${store.slug}`;
  const h = store.theme.header;
  const transparent = h.style === "transparent";

  React.useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  // The transparent header sits over the first section; when that section is
  // dark (image hero / contrast scheme) the header text goes white.
  const [onDark, setOnDark] = React.useState(false);
  React.useEffect(() => {
    if (!transparent) return;
    // Measured after paint: the first section is rendered by the page below.
    const raf = requestAnimationFrame(() => {
      const first = document.querySelector<HTMLElement>(".st-main > .st-section");
      setOnDark(first?.dataset.scheme === "contrast");
    });
    return () => cancelAnimationFrame(raf);
  }, [transparent]);

  const brand = (
    <Link href={base} className={cn("st-wordmark-link st-header-brand flex items-center gap-2")}>
      {store.logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={store.logoUrl} alt={store.name} className={cn(LOGO_H[h.logoSize], "w-auto")} />
      ) : (
        <span className={cn("st-display st-heading-transform", WORD_SIZE[h.logoSize])} style={{ color: "var(--st-fg)", fontWeight: "var(--st-heading-weight)" as React.CSSProperties["fontWeight"] }}>
          {store.name}
        </span>
      )}
    </Link>
  );

  const navItems = store.nav;
  const half = Math.ceil(navItems.length / 2);
  const navLink = (item: { label: string; href: string }) => (
    <Link key={item.href} href={`${base}${item.href}`} className="transition-colors">
      {item.label}
    </Link>
  );

  const actions = (
    <div className="st-header-actions flex items-center gap-1">
      {h.showSearch && (
        <button type="button" onClick={() => setSearchOpen((open) => !open)} className="st-header-link p-2" aria-label="Search" aria-expanded={searchOpen}>
          <Search className="size-4.5" />
        </button>
      )}
      {h.showCart && (
        <button type="button" onClick={() => setDrawerOpen(true)} className="st-header-link relative p-2" aria-label={`Cart (${cart.itemCount} items)`}>
          <ShoppingBag className="size-4.5" />
          {cart.itemCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold" style={{ background: "var(--st-accent)", color: "var(--st-accent-fg)" }}>
              {cart.itemCount > 9 ? "9+" : cart.itemCount}
            </span>
          )}
        </button>
      )}
    </div>
  );

  const menuButton = (
    <button type="button" onClick={() => setMenuOpen(true)} className={cn("st-header-link -ml-1.5 p-1.5", h.style !== "minimal" && "sm:hidden")} aria-label="Open menu">
      <Menu className="size-5" />
    </button>
  );

  return (
    <>
      {store.isDemo && (
        <div className="relative z-50 bg-ink-900 px-4 py-1.5 text-center text-[11.5px] text-white/80">
          Demonstration store — orders placed here are simulated and no payment is taken.
        </div>
      )}

      <div className={cn(transparent && "st-header-wrap")}>
        <header
          className={cn(
            "st-header z-40 backdrop-blur",
            h.sticky && !transparent && "sticky top-0",
            h.border && "border-b",
            transparent && scrolled && "is-scrolled border-b",
            transparent && onDark && "on-dark",
          )}
          style={{ background: "color-mix(in srgb, var(--st-bg) 92%, transparent)", borderColor: "var(--st-border)" }}
        >
          <div className="st-header-inner mx-auto px-5" style={{ maxWidth: "var(--st-max-width)" }}>
            {h.style === "split" ? (
              <>
                <div className="flex items-center gap-4">
                  {menuButton}
                  <nav className="st-header-nav st-header-nav-left hidden gap-6 text-[13.5px] sm:flex">{navItems.slice(0, half).map(navLink)}</nav>
                </div>
                {brand}
                <div className="st-header-right">
                  <nav className="st-header-nav hidden gap-6 text-[13.5px] sm:flex">{navItems.slice(half).map(navLink)}</nav>
                  {actions}
                </div>
              </>
            ) : h.style === "centered" ? (
              <>
                <div className="flex items-center gap-4">
                  {menuButton}
                  <nav className="st-header-nav hidden gap-6 text-[13.5px] sm:flex">{navItems.map(navLink)}</nav>
                </div>
                {brand}
                {actions}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  {menuButton}
                  {brand}
                </div>
                <nav className="st-header-nav ml-4 hidden gap-6 text-[13.5px] sm:flex">{navItems.map(navLink)}</nav>
                {actions}
              </>
            )}
          </div>

          {searchOpen && (
            <div className="border-t px-5 py-3" style={{ borderColor: "var(--st-border)", background: "var(--st-bg)" }}>
              <form
                className="mx-auto flex gap-2"
                style={{ maxWidth: "var(--st-max-width)" }}
                onSubmit={(event) => {
                  event.preventDefault();
                  const query = new FormData(event.currentTarget).get("q");
                  if (typeof query === "string" && query.trim()) {
                    router.push(`${base}/search?q=${encodeURIComponent(query.trim())}`);
                    setSearchOpen(false);
                  }
                }}
              >
                <input name="q" autoFocus placeholder="Search products…" className="st-input flex-1" style={{ color: "var(--st-fg)" }} />
                <button type="submit" className="st-btn">Search</button>
              </form>
            </div>
          )}
        </header>
      </div>

      {menuOpen && (
        <div className={cn("fixed inset-0 z-50", h.style !== "minimal" && "sm:hidden")}>
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <nav className="absolute inset-y-0 left-0 w-72 p-5 shadow-xl" style={{ background: "var(--st-bg)", color: "var(--st-fg)" }} aria-label="Menu">
            <div className="mb-6 flex items-center justify-between">
              <span className="st-display text-[15px]" style={{ fontWeight: "var(--st-heading-weight)" as React.CSSProperties["fontWeight"] }}>{store.name}</span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="st-header-link p-1">
                <X className="size-4" />
              </button>
            </div>
            <ul className="space-y-1">
              {[{ label: "Home", href: "/" }, ...store.nav].map((item) => (
                <li key={item.href}>
                  <Link href={`${base}${item.href === "/" ? "" : item.href}`} onClick={() => setMenuOpen(false)} className="st-radius-sm block px-3 py-2.5 text-[14.5px] hover:opacity-70">
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
