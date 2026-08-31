"use client";

import * as React from "react";
import { Check, Minus, Plus, Truck, Undo2 } from "lucide-react";
import { useCart } from "@/components/storefront/cart-provider";
import { StorefrontAnalytics } from "@/components/storefront/analytics";
import { Price, ProductCard, Stars, StoreLink } from "@/components/storefront/primitives";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/lib/storefront/data";

type Variant = {
  id: string;
  title: string;
  options: Record<string, string>;
  price: number | null;
  inventory: number;
  imageUrl: string | null;
};

export function ProductDetail({
  storeSlug, currency, product, ctaLabel, priceNote,
  rating, reviewCount, ratingDistribution, reviews, recommended,
}: {
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
  reviews: Array<{
    id: string; authorName: string; rating: number; title: string | null;
    body: string; verified: boolean; createdAt: string;
  }>;
  recommended: ProductCardData[];
}) {
  const { add } = useCart();
  const [quantity, setQuantity] = React.useState(1);
  const [adding, setAdding] = React.useState(false);
  const [added, setAdded] = React.useState(false);

  // Option axes reconstructed from the variant option maps.
  const axes = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const variant of product.variants) {
      for (const [name, value] of Object.entries(variant.options)) {
        const values = map.get(name) ?? [];
        if (!values.includes(value)) values.push(value);
        map.set(name, values);
      }
    }
    return [...map.entries()].map(([name, values]) => ({ name, values }));
  }, [product.variants]);

  const [selection, setSelection] = React.useState<Record<string, string>>(() => {
    const firstAvailable = product.variants.find((variant) => variant.inventory > 0) ?? product.variants[0];
    return firstAvailable?.options ?? {};
  });

  const selectedVariant = React.useMemo(() => {
    if (!product.variants.length) return null;
    return (
      product.variants.find((variant) =>
        Object.entries(selection).every(([name, value]) => variant.options[name] === value),
      ) ?? null
    );
  }, [product.variants, selection]);

  const price = selectedVariant?.price ?? product.price;
  const available = selectedVariant
    ? selectedVariant.inventory
    : product.trackInventory
      ? product.inventory
      : Number.MAX_SAFE_INTEGER;
  const needsSelection = product.variants.length > 0 && !selectedVariant;
  const soldOut = !needsSelection && product.trackInventory && available <= 0;

  // Choosing a variant moves the gallery to that variant's image, unless the
  // shopper has since picked a different one for this same variant.
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

  const maxRatingCount = Math.max(...ratingDistribution.map((row) => row.count), 1);

  return (
    <>
      <StorefrontAnalytics storeSlug={storeSlug} type="product_view" productId={product.id} />

      <div className="mx-auto max-w-6xl px-5 py-8">
        <nav className="mb-6 flex items-center gap-1.5 text-[12.5px] text-ink-500">
          <StoreLink href="/shop" storeSlug={storeSlug} className="hover:text-ink-800">Shop</StoreLink>
          {product.categoryName && (
            <>
              <span>/</span>
              <span>{product.categoryName}</span>
            </>
          )}
          <span>/</span>
          <span className="text-ink-700">{product.title}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <div className="overflow-hidden rounded-lg bg-ink-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.images[imageIndex]?.url ?? "/placeholder.svg"}
                alt={product.images[imageIndex]?.alt ?? product.title}
                className="aspect-square w-full object-cover"
              />
            </div>
            {product.images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto scroll-thin">
                {product.images.map((image, index) => (
                  <button
                    key={`${image.url}-${index}`}
                    type="button"
                    onClick={() => setImageIndex(index)}
                    className={cn(
                      "size-16 shrink-0 overflow-hidden rounded-md border-2 bg-ink-100",
                      index === imageIndex ? "border-ink-900" : "border-transparent hover:border-ink-300",
                    )}
                    aria-label={`View image ${index + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            {product.vendor && (
              <p className="text-[12.5px] uppercase tracking-[0.08em] text-ink-400">{product.vendor}</p>
            )}
            <h1 className="mt-1 text-[27px] font-semibold leading-tight tracking-[-0.02em] text-ink-900">
              {product.title}
            </h1>

            {reviewCount > 0 && rating !== null && (
              <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-[13px] text-ink-500 hover:text-ink-800">
                <Stars rating={rating} size={13} />
                {rating.toFixed(1)} · {reviewCount} review{reviewCount === 1 ? "" : "s"}
              </a>
            )}

            <div className="mt-4">
              <Price price={price} compareAtPrice={product.compareAtPrice} currency={currency} className="text-[21px] font-medium text-ink-900" />
              {priceNote && <p className="mt-1 text-[13px] text-ink-500">{priceNote}</p>}
            </div>

            {axes.map((axis) => (
              <div key={axis.name} className="mt-5">
                <p className="mb-2 text-[13px] font-medium text-ink-800">
                  {axis.name}
                  {selection[axis.name] && <span className="ml-1.5 font-normal text-ink-500">{selection[axis.name]}</span>}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {axis.values.map((value) => {
                    const candidate = { ...selection, [axis.name]: value };
                    const variant = product.variants.find((v) =>
                      Object.entries(candidate).every(([name, selected]) => v.options[name] === selected),
                    );
                    const outOfStock = variant ? variant.inventory <= 0 : false;
                    const selected = selection[axis.name] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSelection(candidate)}
                        className={cn(
                          "min-w-11 rounded-md border px-3 py-2 text-[13px] transition-colors",
                          selected
                            ? "border-ink-900 bg-ink-900 text-white"
                            : "border-ink-200 bg-white text-ink-700 hover:border-ink-400",
                          outOfStock && !selected && "text-ink-300 line-through",
                        )}
                        aria-pressed={selected}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex h-11 items-center rounded-md border border-ink-200">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 text-ink-500 hover:text-ink-900"
                  aria-label="Decrease quantity"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="tabular w-8 text-center text-[14px]">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(available, q + 1))}
                  disabled={quantity >= available}
                  className="px-3 text-ink-500 hover:text-ink-900 disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={onAdd}
                disabled={adding || soldOut || needsSelection}
                className="inline-flex h-11 flex-1 min-w-40 items-center justify-center gap-2 rounded-md px-6 text-[14.5px] font-medium text-white transition-opacity disabled:opacity-50"
                style={{ background: "var(--store-primary)" }}
              >
                {added ? (
                  <>
                    <Check className="size-4" />
                    Added
                  </>
                ) : soldOut ? (
                  "Sold out"
                ) : needsSelection ? (
                  "Choose an option"
                ) : adding ? (
                  "Adding…"
                ) : (
                  ctaLabel
                )}
              </button>
            </div>

            {product.trackInventory && available > 0 && available <= 10 && (
              <p className="mt-2.5 text-[13px] text-[var(--color-signal-warning)]">
                Only {available} left in stock.
              </p>
            )}

            <ul className="mt-6 space-y-2 border-t border-ink-200 pt-5 text-[13px] text-ink-600">
              <li className="flex items-center gap-2">
                <Truck className="size-4 text-ink-400" />
                Free shipping on orders over {formatMoney(75, currency)}
              </li>
              <li className="flex items-center gap-2">
                <Undo2 className="size-4 text-ink-400" />
                Free returns within 60 days
              </li>
            </ul>

            {product.description && (
              <div className="mt-6 border-t border-ink-200 pt-5">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-400">Details</h2>
                <p className="mt-2.5 whitespace-pre-line text-[14px] leading-relaxed text-ink-700">
                  {product.description}
                </p>
              </div>
            )}

            {product.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-ink-200 px-2.5 py-0.5 text-[11.5px] text-ink-500">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <section id="reviews" className="mt-16 border-t border-ink-200 pt-10">
          <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-ink-900">Reviews</h2>

          {reviewCount === 0 ? (
            <p className="mt-3 text-[14px] text-ink-500">No reviews for this product yet.</p>
          ) : (
            <div className="mt-5 grid gap-8 lg:grid-cols-[220px_1fr]">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="tabular text-[32px] font-semibold text-ink-900">
                    {(rating ?? 0).toFixed(1)}
                  </span>
                  <Stars rating={rating ?? 0} size={14} />
                </div>
                <p className="mt-0.5 text-[12.5px] text-ink-500">
                  Based on {reviewCount} review{reviewCount === 1 ? "" : "s"}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = ratingDistribution.find((row) => row.rating === star)?.count ?? 0;
                    return (
                      <li key={star} className="flex items-center gap-2 text-[12px] text-ink-500">
                        <span className="tabular w-3">{star}</span>
                        <span className="text-[var(--color-signal-warning)]">★</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                          <span
                            className="block h-full rounded-full bg-[var(--color-signal-warning)]"
                            style={{ width: `${(count / maxRatingCount) * 100}%` }}
                          />
                        </span>
                        <span className="tabular w-6 text-right">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <ul className="space-y-6">
                {reviews.map((review) => (
                  <li key={review.id} className="border-b border-ink-200 pb-6 last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars rating={review.rating} />
                      {review.title && <h3 className="text-[14px] font-semibold text-ink-900">{review.title}</h3>}
                    </div>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-ink-700">{review.body}</p>
                    <p className="mt-2 text-[12px] text-ink-400">
                      {review.authorName}
                      {review.verified && " · Verified purchase"} · {formatDate(review.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {recommended.length > 0 && (
          <section className="mt-16 border-t border-ink-200 pt-10">
            <h2 className="mb-6 text-[20px] font-semibold tracking-[-0.015em] text-ink-900">You may also like</h2>
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4">
              {recommended.map((item) => (
                <ProductCard key={item.id} product={item} storeSlug={storeSlug} currency={currency} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
