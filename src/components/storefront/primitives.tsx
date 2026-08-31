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
    <StoreLink href={`/products/${product.slug}`} storeSlug={storeSlug} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-md bg-ink-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl ?? "/placeholder.svg"}
          alt={product.title}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {product.secondaryImageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.secondaryImageUrl}
            alt=""
            loading="lazy"
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        {!product.inStock && (
          <span className="absolute left-2 top-2 rounded bg-white/95 px-2 py-0.5 text-[11px] font-medium text-ink-700">
            Sold out
          </span>
        )}
        {product.compareAtPrice != null && product.compareAtPrice > product.price && product.inStock && (
          <span className="absolute left-2 top-2 rounded bg-[var(--color-signal-negative)] px-2 py-0.5 text-[11px] font-medium text-white">
            Sale
          </span>
        )}
      </div>
      <div className="mt-2.5">
        <h3 className="text-[13.5px] font-medium leading-snug text-ink-900 group-hover:underline">
          {product.title}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          <Price price={product.price} compareAtPrice={product.compareAtPrice} currency={currency} className="text-[13px] text-ink-700" />
          {product.reviewCount > 0 && product.rating !== null && (
            <span className="flex items-center gap-1 text-[11.5px] text-ink-400">
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
  const backgrounds: Record<string, string> = {
    white: "bg-white text-ink-900",
    muted: "bg-ink-50 text-ink-900",
    brand: "bg-[var(--store-primary)] text-white",
    ink: "bg-ink-900 text-white",
  };
  const spacings: Record<string, string> = {
    compact: "py-8 sm:py-10",
    normal: "py-12 sm:py-16",
    roomy: "py-16 sm:py-24",
  };
  return (
    <section className={cn(backgrounds[background] ?? backgrounds.white, spacings[spacing] ?? spacings.normal, className)}>
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
    <div className={cn("mb-7", align === "center" && "text-center", className)}>
      {title && (
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">{title}</h2>
      )}
      {subtitle && <p className="mt-1.5 text-[14.5px] opacity-70">{subtitle}</p>}
    </div>
  );
}
