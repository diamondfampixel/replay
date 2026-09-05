import Link from "next/link";
import type { CSSProperties } from "react";
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
      className="inline-flex items-center gap-px leading-none"
      style={{ fontSize: size, color: "var(--st-warning, #a1660a)" }}
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true">{rounded >= n ? "★" : rounded >= n - 0.5 ? "◐" : "☆"}</span>
      ))}
    </span>
  );
}

export function Price({
  price, compareAtPrice, currency, className, emphasis = "normal",
}: {
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  className?: string;
  emphasis?: "muted" | "normal" | "strong";
}) {
  const onSale = compareAtPrice != null && compareAtPrice > price;
  return (
    <span className={cn("tabular inline-flex items-baseline gap-1.5", emphasis === "strong" && "font-semibold", emphasis === "muted" && "st-muted", className)}>
      <span style={onSale ? { color: "var(--st-sale)" } : undefined}>
        {formatMoney(price, currency)}
      </span>
      {onSale && (
        <span className="st-price-compare st-muted text-[0.85em] line-through">
          {formatMoney(compareAtPrice, currency)}
        </span>
      )}
    </span>
  );
}

export function ProductCard({
  product, storeSlug, currency, showRating = true, priceEmphasis = "normal", style,
}: {
  product: ProductCardData;
  storeSlug: string;
  currency: string;
  showRating?: boolean;
  priceEmphasis?: "muted" | "normal" | "strong";
  style?: CSSProperties;
}) {
  return (
    <StoreLink href={`/products/${product.slug}`} storeSlug={storeSlug} className="st-product-card st-card-hover group block" style={style}>
      <div className="st-product-media relative overflow-hidden" style={{ background: "var(--st-surface-alt)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl ?? "/placeholder.svg"}
          alt={product.title}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
        {product.secondaryImageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.secondaryImageUrl}
            alt=""
            loading="lazy"
            aria-hidden="true"
            className="st-swap absolute inset-0 size-full object-cover opacity-0"
          />
        )}
        {!product.inStock && (
          <span className="st-badge absolute left-2 top-2" style={{ background: "var(--st-bg)", color: "var(--st-fg)" }}>
            Sold out
          </span>
        )}
        {product.compareAtPrice != null && product.compareAtPrice > product.price && product.inStock && (
          <span className="st-badge absolute left-2 top-2" style={{ background: "var(--st-sale)", color: "var(--st-sale-fg)" }}>
            Sale
          </span>
        )}
      </div>
      <div className="st-product-body">
        <h3 className="text-[14px] font-medium leading-snug group-hover:underline" style={{ color: "var(--st-fg)", fontFamily: "inherit", letterSpacing: "0", fontWeight: 500 }}>
          {product.title}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2" style={{ justifyContent: "inherit" }}>
          <Price price={product.price} compareAtPrice={product.compareAtPrice} currency={currency} emphasis={priceEmphasis} className={cn("text-[13.5px]", priceEmphasis === "normal" && "st-muted")} />
          {showRating && product.reviewCount > 0 && product.rating !== null && (
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

/** Grid columns for product cards — desktop count + mobile count → classes. */
export function gridClass(columns: number, mobile: 1 | 2 = 2): string {
  const desktop =
    columns <= 2 ? "sm:grid-cols-2"
    : columns === 3 ? "sm:grid-cols-3"
    : columns === 4 ? "sm:grid-cols-3 lg:grid-cols-4"
    : "sm:grid-cols-3 lg:grid-cols-5";
  return cn("grid st-grid-gap", mobile === 1 ? "grid-cols-1" : "grid-cols-2", desktop);
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  if (!children) return null;
  return <p className={cn("st-eyebrow mb-3", className)}>{children}</p>;
}

export function SectionHeading({
  eyebrow, title, subtitle, align, size = "md", className, action,
}: {
  eyebrow?: string | null;
  title?: string | null;
  subtitle?: string | null;
  /** Explicit override; otherwise the section shell's alignment applies. */
  align?: "left" | "center";
  size?: "sm" | "md" | "lg";
  className?: string;
  action?: React.ReactNode;
}) {
  if (!title && !subtitle && !eyebrow) return null;
  const sizeClass = size === "lg" ? "st-h-lg" : size === "sm" ? "st-h-sm" : "st-h-md";
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", align === "center" && "justify-center text-center", className)}>
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        <Eyebrow>{eyebrow}</Eyebrow>
        {title && <h2 className={cn("st-heading-transform", sizeClass)}>{title}</h2>}
        {subtitle && <p className="st-muted st-lead mt-2.5 max-w-xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="st-radius border border-dashed px-4 py-8 text-center text-[13px]" style={{ borderColor: "var(--st-border-strong)", color: "var(--st-muted-fg)" }}>
      {children}
    </p>
  );
}
