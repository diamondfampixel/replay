import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { ProductCardData } from "@/lib/storefront/data";

export function StoreLink({
  storeSlug, href, className, children, ...props
}: {
  storeSlug: string;
  href: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href">) {
  const path = href.startsWith("http") ? href : `/s/${storeSlug}${href === "/" ? "" : href}`;
  return (
    <Link href={path} className={className} {...props}>
      {children}
    </Link>
  );
}

export function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span
      className="inline-flex items-center gap-px leading-none text-[var(--color-signal-warning)]"
      style={{ fontSize: size }}
      aria-label={`${rating.toFixed(1)} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true">{rounded >= n ? "★" : rounded >= n - 0.5 ? "◐" : "☆"}</span>
      ))}
    </span>
  );
}

export function Price({
  price, compareAtPrice, currency, className,
}: {
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  className?: string;
}) {
  const onSale = compareAtPrice != null && compareAtPrice > price;
  return (
    <span className={cn("tabular inline-flex items-baseline gap-1.5", className)}>
      <span className={onSale ? "text-[var(--color-signal-negative)]" : undefined}>
        {formatMoney(price, currency)}
      </span>
      {onSale && (
        <span className="text-[0.85em] text-ink-400 line-through">
          {formatMoney(compareAtPrice, currency)}
        </span>
      )}
    </span>
  );
}

export function ProductCard({
  product, storeSlug, currency,
}: {
  product: ProductCardData;
  storeSlug: string;
  currency: string;
}) {
  return (
    <StoreLink href={`/products/${product.slug}`} storeSlug={storeSlug} className="st-product-card st-card-hover group block">
      <div className="st-product-media st-radius relative overflow-hidden" style={{ background: "var(--st-surface-alt)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl ?? "/placeholder.svg"}
          alt={product.title}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {product.secondaryImageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.secondaryImageUrl}
            alt=""
            loading="lazy"
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}
        {!product.inStock && (
          <span className="st-radius-sm absolute left-2 top-2 bg-white/95 px-2 py-0.5 text-[11px] font-medium text-ink-700">
            Sold out
          </span>
        )}
        {product.compareAtPrice != null && product.compareAtPrice > product.price && product.inStock && (
          <span className="st-radius-sm absolute left-2 top-2 px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: "var(--color-signal-negative)" }}>
            Sale
          </span>
        )}
      </div>
      <div className="st-product-body mt-3">
        <h3 className="text-[14px] font-medium leading-snug group-hover:underline" style={{ color: "var(--st-fg)" }}>
          {product.title}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          <Price price={product.price} compareAtPrice={product.compareAtPrice} currency={currency} className="st-muted text-[13.5px]" />
          {product.reviewCount > 0 && product.rating !== null && (
            <span className="st-muted flex items-center gap-1 text-[11.5px]">
              <Stars rating={product.rating} size={10} />
              ({product.reviewCount})
            </span>
          )}
        </div>
      </div>
    </StoreLink>
  );
}

export function SectionShell({
  background = "white",
  spacing = "normal",
  className,
  children,
}: {
  background?: string;
  spacing?: string;
  className?: string;
  children: React.ReactNode;
}) {
  // Background roles resolve to theme tokens so a section reads correctly on
  // every design direction (a "muted" band on a warm store is warm, not grey).
  const styles: Record<string, React.CSSProperties> = {
    white: { background: "var(--st-bg)", color: "var(--st-fg)" },
    muted: { background: "var(--st-surface-alt)", color: "var(--st-fg)" },
    brand: { background: "var(--st-accent)", color: "var(--st-accent-fg)" },
    ink: { background: "var(--st-contrast-bg)", color: "var(--st-contrast-fg)" },
  };
  // Density scales with the theme; the enum nudges it up or down a step.
  const pad: Record<string, string> = {
    compact: "clamp(2rem, calc(var(--st-section-gap) * 0.7), 4rem)",
    normal: "var(--st-section-gap)",
    roomy: "var(--st-section-gap-sm)",
  };
  return (
    <section
      className={cn("st-reveal", className)}
      style={{ ...(styles[background] ?? styles.white), paddingTop: pad[spacing] ?? pad.normal, paddingBottom: pad[spacing] ?? pad.normal }}
    >
      <div className="mx-auto max-w-6xl px-5">{children}</div>
    </section>
  );
}

export function SectionHeading({
  title, subtitle, align = "left", className,
}: {
  title?: string | null;
  subtitle?: string | null;
  align?: "left" | "center";
  className?: string;
}) {
  if (!title && !subtitle) return null;
  return (
    <div className={cn("mb-8", align === "center" && "text-center", className)}>
      {title && (
        <h2 className="st-heading-transform text-[24px] leading-[1.1] sm:text-[30px]">{title}</h2>
      )}
      {subtitle && <p className="st-muted mt-2 text-[15px]">{subtitle}</p>}
    </div>
  );
}
