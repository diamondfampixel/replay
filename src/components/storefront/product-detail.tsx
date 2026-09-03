"use client";

import * as React from "react";
import { Check, ChevronDown, Link2, Minus, Plus, Share2 } from "lucide-react";
import { useCart } from "@/components/storefront/cart-provider";
import { StorefrontAnalytics } from "@/components/storefront/analytics";
import { Price, ProductCard, Stars, StoreLink } from "@/components/storefront/primitives";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/lib/storefront/data";
import type { ResolvedTheme } from "@/lib/storefront/theme";
import { deriveOptionAxes } from "@/lib/variant-options";

type Variant = {
  id: string;
  title: string;
  options: Record<string, string>;
  price: number | null;
  inventory: number;
  imageUrl: string | null;
};

type ProductProps = {
  storeSlug: string;
  currency: string;
  product: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    price: number;
    compareAtPrice: number | null;
    inventory: number;
    trackInventory: boolean;
    vendor: string | null;
    tags: string[];
    categoryName: string | null;
    images: Array<{ url: string; alt: string }>;
    variants: Variant[];
  };
  ctaLabel: string;
  priceNote: string | null;
  rating: number | null;
  reviewCount: number;
  ratingDistribution: Array<{ rating: number; count: number }>;
  reviews: Array<{ id: string; authorName: string; rating: number; title: string | null; body: string; verified: boolean; createdAt: string }>;
  recommended: ProductCardData[];
  /** Layout + block order from the store's design system. */
  design: ResolvedTheme["product"] & { cards: ResolvedTheme["cards"] };
  /** Real trust claims only: from the theme's trust items or store settings. */
  trustItems: string[];
};

/**
 * Product page with six layouts and a reorderable set of information blocks.
 * Commerce logic (variants, stock, add-to-cart) is identical across layouts —
 * the design system only decides where things sit and how they look.
 */
export function ProductDetail(props: ProductProps) {
  const { storeSlug, currency, product, ctaLabel, priceNote, rating, reviewCount, ratingDistribution, reviews, recommended, design, trustItems } = props;
  const { add } = useCart();
  const [quantity, setQuantity] = React.useState(1);
  const [adding, setAdding] = React.useState(false);
  const [added, setAdded] = React.useState(false);

  const axes = React.useMemo(() => deriveOptionAxes(product.variants), [product.variants]);
  const [selection, setSelection] = React.useState<Record<string, string>>(() => {
    const firstAvailable = product.variants.find((variant) => variant.inventory > 0) ?? product.variants[0];
    return firstAvailable?.options ?? {};
  });
  const selectedVariant = React.useMemo(() => {
    if (!product.variants.length) return null;
    return product.variants.find((variant) => Object.entries(selection).every(([name, value]) => variant.options[name] === value)) ?? null;
  }, [product.variants, selection]);

  const price = selectedVariant?.price ?? product.price;
  const available = selectedVariant ? selectedVariant.inventory : product.trackInventory ? product.inventory : Number.MAX_SAFE_INTEGER;
  const needsSelection = product.variants.length > 0 && !selectedVariant;
  const soldOut = !needsSelection && product.trackInventory && available <= 0;

  const variantKey = selectedVariant?.id ?? "";
  const variantImageIndex = React.useMemo(() => {
    if (!selectedVariant?.imageUrl) return 0;
    const index = product.images.findIndex((image) => image.url === selectedVariant.imageUrl);
    return index >= 0 ? index : 0;
  }, [selectedVariant, product.images]);
  const [manualImage, setManualImage] = React.useState<{ key: string; index: number } | null>(null);
  const imageIndex = manualImage?.key === variantKey ? manualImage.index : variantImageIndex;
  const setImageIndex = (index: number) => setManualImage({ key: variantKey, index });

  async function onAdd() {
    setAdding(true);
    const success = await add(product.id, selectedVariant?.id ?? null, quantity);
    setAdding(false);
    if (success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  }

  const layout = design.layout;
  const immersive = layout === "immersive";
  const onDark = immersive && product.images.length > 0;

  // --- blocks ---------------------------------------------------------------
  const blocks: Record<string, React.ReactNode> = {
    vendor: product.vendor ? <p className="st-eyebrow">{product.vendor}</p> : null,
    title: <h1 className={cn("st-heading-transform", layout === "minimal" ? "st-h-md" : "st-h-lg")}>{product.title}</h1>,
    rating: reviewCount > 0 && rating !== null ? (
      <a href="#reviews" className="st-muted inline-flex items-center gap-2 text-[13px] hover:opacity-80">
        <Stars rating={rating} size={13} />
        {rating.toFixed(1)} · {reviewCount} review{reviewCount === 1 ? "" : "s"}
      </a>
    ) : null,
    price: (
      <div>
        <Price price={price} compareAtPrice={product.compareAtPrice} currency={currency} className="text-[21px]" emphasis={design.cards.priceEmphasis === "muted" ? "normal" : "strong"} />
        {priceNote && <p className="st-muted mt-1 text-[13px]">{priceNote}</p>}
      </div>
    ),
    variants: axes.length ? (
      <div className="space-y-5">
        {axes.map((axis) => (
          <div key={axis.name}>
            <p className="mb-2 text-[13px] font-medium">
              {axis.name}
              {selection[axis.name] && <span className="st-muted ml-1.5 font-normal">{selection[axis.name]}</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {axis.values.map((value) => {
                const candidate = { ...selection, [axis.name]: value };
                const variant = product.variants.find((v) => Object.entries(candidate).every(([name, selected]) => v.options[name] === selected));
                const outOfStock = variant ? variant.inventory <= 0 : false;
                const selected = selection[axis.name] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelection(candidate)}
                    className={cn("min-w-11 border px-3 py-2 text-[13px] transition-colors", outOfStock && !selected && "line-through opacity-50")}
                    style={{ borderRadius: "var(--st-radius-input)", ...(selected ? { background: "var(--st-fg)", color: "var(--st-bg)", borderColor: "var(--st-fg)" } : { borderColor: "var(--st-border-strong)" }) }}
                    aria-pressed={selected}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    ) : null,
    quantityBuy: (
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center border" style={{ height: "var(--st-btn-h)", borderRadius: "var(--st-radius-input)", borderColor: "var(--st-border-strong)" }}>
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="st-muted px-3 hover:opacity-70" aria-label="Decrease quantity"><Minus className="size-3.5" /></button>
          <span className="tabular w-8 text-center text-[14px]">{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => Math.min(available, q + 1))} disabled={quantity >= available} className="st-muted px-3 hover:opacity-70 disabled:opacity-40" aria-label="Increase quantity"><Plus className="size-3.5" /></button>
        </div>
        <button type="button" onClick={onAdd} disabled={adding || soldOut || needsSelection} className="st-btn min-w-40 flex-1 disabled:opacity-50">
          {added ? (<><Check className="size-4" />Added</>) : soldOut ? "Sold out" : needsSelection ? "Choose an option" : adding ? "Adding…" : ctaLabel}
        </button>
      </div>
    ),
    inventory: product.trackInventory && available > 0 && available <= 10 ? (
      <p className="text-[13px]" style={{ color: "var(--st-warning)" }}>Only {available} left in stock.</p>
    ) : null,
    trust: trustItems.length ? (
      <ul className="st-muted space-y-2 border-t pt-5 text-[13px]" style={{ borderColor: "var(--st-border)" }}>
        {trustItems.map((item) => (
          <li key={item} className="flex items-center gap-2"><Check className="size-3.5 shrink-0" style={{ color: "var(--st-success)" }} />{item}</li>
        ))}
      </ul>
    ) : null,
    description: product.description ? (
      <div className="border-t pt-5" style={{ borderColor: "var(--st-border)" }}>
        <h2 className="st-eyebrow mb-2.5">Details</h2>
        <p className="whitespace-pre-line text-[14.5px] leading-relaxed opacity-85">{product.description}</p>
      </div>
    ) : null,
    details: <Details rows={[
      ...(product.categoryName || product.vendor ? [{ title: "Specifications", body: [product.vendor && `Brand: ${product.vendor}`, product.categoryName && `Category: ${product.categoryName}`].filter(Boolean).join("\n") }] : []),
      ...(trustItems.length ? [{ title: "Shipping & returns", body: trustItems.join("\n") }] : []),
    ]} />,
    tags: product.tags.length ? (
      <div className="flex flex-wrap gap-1.5">
        {product.tags.map((tag) => <span key={tag} className="st-badge st-muted border" style={{ borderColor: "var(--st-border)" }}>{tag}</span>)}
      </div>
    ) : null,
    share: <ShareButton title={product.title} />,
  };

  const info = (
    <div className={cn("space-y-5", onDark && "st-glass st-radius-card border p-6 sm:p-8")} style={onDark ? { background: "color-mix(in srgb, var(--st-bg) 82%, transparent)", borderColor: "var(--st-border)" } : undefined}>
      {design.blocks.map((key) => (blocks[key] ? <div key={key}>{blocks[key]}</div> : null))}
    </div>
  );

  const gallery = (mode: "thumbs" | "grid" | "stack" | "hero") => {
    const ratio = `var(--st-product-ratio, 1 / 1)`;
    const img = (image: { url: string; alt: string }, i: number, cls?: string) => (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img key={`${image.url}-${i}`} src={image.url} alt={image.alt} className={cn("st-radius-image w-full object-cover", cls)} style={{ aspectRatio: ratio, background: "var(--st-surface-alt)" }} loading={i === 0 ? "eager" : "lazy"} />
    );
    if (!product.images.length) return <div className="st-radius-image w-full" style={{ aspectRatio: ratio, background: "var(--st-surface-alt)" }} />;
    if (mode === "grid") {
      return (
        <div className="grid grid-cols-2 st-grid-gap">
          {product.images.map((image, i) => img(image, i, i === 0 ? "col-span-2" : ""))}
        </div>
      );
    }
    if (mode === "stack") return <div className="space-y-4">{product.images.map((image, i) => img(image, i))}</div>;
    return (
      <div>
        <div className="st-zoom st-radius-image overflow-hidden" style={{ background: "var(--st-surface-alt)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.images[imageIndex]?.url ?? "/placeholder.svg"} alt={product.images[imageIndex]?.alt ?? product.title} className="w-full object-cover" style={{ aspectRatio: ratio }} />
        </div>
        {product.images.length > 1 && (
          <div className={cn("scroll-thin mt-3 flex gap-2 overflow-x-auto", mode === "hero" && "justify-center")}>
            {product.images.map((image, index) => (
              <button key={`${image.url}-${index}`} type="button" onClick={() => setImageIndex(index)} className="size-16 shrink-0 overflow-hidden border-2 st-radius-sm" style={{ borderColor: index === imageIndex ? "var(--st-fg)" : "transparent", background: "var(--st-surface-alt)" }} aria-label={`View image ${index + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const breadcrumb = (
    <nav className="st-muted mb-6 flex items-center gap-1.5 text-[12.5px]" aria-label="Breadcrumb">
      <StoreLink href="/shop" storeSlug={storeSlug} className="hover:opacity-70">Shop</StoreLink>
      {product.categoryName && (<><span>/</span><span>{product.categoryName}</span></>)}
      <span>/</span>
      <span style={{ color: "var(--st-fg)" }}>{product.title}</span>
    </nav>
  );

  const maxRatingCount = Math.max(...ratingDistribution.map((row) => row.count), 1);
  const reviewsBlock = design.showReviews && (
    <section id="reviews" className="mt-16 border-t pt-10" style={{ borderColor: "var(--st-border)" }}>
      <h2 className="st-h-md">Reviews</h2>
      {reviewCount === 0 ? (
        <p className="st-muted mt-3 text-[14px]">No reviews for this product yet.</p>
      ) : (
        <div className="mt-5 grid gap-8 lg:grid-cols-[220px_1fr]">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="st-display tabular text-[32px]">{(rating ?? 0).toFixed(1)}</span>
              <Stars rating={rating ?? 0} size={14} />
            </div>
            <p className="st-muted mt-0.5 text-[12.5px]">Based on {reviewCount} review{reviewCount === 1 ? "" : "s"}</p>
            <ul className="mt-4 space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingDistribution.find((row) => row.rating === star)?.count ?? 0;
                return (
                  <li key={star} className="st-muted flex items-center gap-2 text-[12px]">
                    <span className="tabular w-3">{star}</span>
                    <span style={{ color: "var(--st-warning)" }}>★</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--st-surface-alt)" }}>
                      <span className="block h-full rounded-full" style={{ width: `${(count / maxRatingCount) * 100}%`, background: "var(--st-warning)" }} />
                    </span>
                    <span className="tabular w-6 text-right">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <ul className="space-y-6">
            {reviews.map((review) => (
              <li key={review.id} className="border-b pb-6 last:border-0" style={{ borderColor: "var(--st-border)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <Stars rating={review.rating} />
                  {review.title && <h3 className="text-[14px] font-semibold">{review.title}</h3>}
                </div>
                <p className="mt-1.5 text-[14px] leading-relaxed opacity-85">{review.body}</p>
                <p className="st-muted mt-2 text-[12px]">{review.authorName}{review.verified && " · Verified purchase"} · {formatDate(review.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
  const recommendedBlock = design.showRecommended && recommended.length > 0 && (
    <section className="mt-16 border-t pt-10" style={{ borderColor: "var(--st-border)" }}>
      <h2 className="st-h-md mb-6">You may also like</h2>
      <div className="grid grid-cols-2 st-grid-gap sm:grid-cols-4">
        {recommended.map((item) => <ProductCard key={item.id} product={item} storeSlug={storeSlug} currency={currency} showRating={design.cards.showRating} priceEmphasis={design.cards.priceEmphasis} />)}
      </div>
    </section>
  );

  const container = { maxWidth: layout === "minimal" ? "880px" : "var(--st-max-width)" };

  return (
    <>
      <StorefrontAnalytics storeSlug={storeSlug} type="product_view" productId={product.id} />

      {immersive && (
        <div className="relative min-h-[70vh] overflow-hidden" style={{ background: "var(--st-surface-alt)" }}>
          {product.images[0] && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={product.images[imageIndex]?.url ?? product.images[0].url} alt={product.images[0].alt} className="absolute inset-0 size-full object-cover" />
          )}
          <div className="relative mx-auto grid min-h-[70vh] items-end px-5 py-10 sm:px-7 lg:grid-cols-12" style={container}>
            <div className="lg:col-span-5 lg:col-start-8">{info}</div>
          </div>
        </div>
      )}

      <div className="mx-auto px-5 py-8 sm:px-7" style={container}>
        {!immersive && breadcrumb}

        {layout === "stacked" ? (
          <div className="grid gap-10">
            <div className="mx-auto w-full max-w-3xl">{gallery("hero")}</div>
            <div className="mx-auto w-full max-w-xl">{info}</div>
          </div>
        ) : layout === "minimal" ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-12">
            <div>{gallery("thumbs")}</div>
            <div className="lg:sticky lg:top-24 lg:self-start">{info}</div>
          </div>
        ) : layout === "gallery" ? (
          <div className="grid gap-8 lg:grid-cols-[3fr_2fr] lg:gap-12">
            <div>{gallery("grid")}</div>
            <div className="lg:sticky lg:top-24 lg:self-start">{info}</div>
          </div>
        ) : layout === "stickyInfo" ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:gap-14">
            <div>{gallery("stack")}</div>
            <div className="lg:sticky lg:top-24 lg:self-start">{info}</div>
          </div>
        ) : immersive ? (
          product.images.length > 1 ? (
            <div className="grid grid-cols-2 st-grid-gap sm:grid-cols-4">
              {product.images.map((image, i) => (
                <button key={`${image.url}-${i}`} type="button" onClick={() => { setImageIndex(i); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="st-zoom st-radius-image overflow-hidden" aria-label={`View image ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="w-full object-cover" style={{ aspectRatio: "1 / 1" }} loading="lazy" />
                </button>
              ))}
            </div>
          ) : null
        ) : (
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            <div>{gallery("thumbs")}</div>
            <div>{info}</div>
          </div>
        )}

        {reviewsBlock}
        {recommendedBlock}
      </div>
    </>
  );
}

function Details({ rows }: { rows: Array<{ title: string; body: string }> }) {
  const [open, setOpen] = React.useState<number | null>(null);
  if (!rows.length) return null;
  return (
    <ul className="border-t" style={{ borderColor: "var(--st-border)" }}>
      {rows.map((row, i) => (
        <li key={row.title} className="border-b" style={{ borderColor: "var(--st-border)" }}>
          <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-[14px] font-medium">
            {row.title}
            <ChevronDown className={cn("size-4 opacity-50 transition-transform", open === i && "rotate-180")} />
          </button>
          {open === i && <p className="st-muted whitespace-pre-line pb-4 text-[13.5px] leading-relaxed">{row.body}</p>}
        </li>
      ))}
    </ul>
  );
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          try { await navigator.share({ title, url }); return; } catch { /* dismissed */ }
        }
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
      }}
      className="st-muted inline-flex items-center gap-1.5 text-[13px] hover:opacity-70"
    >
      {copied ? <Link2 className="size-3.5" /> : <Share2 className="size-3.5" />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
