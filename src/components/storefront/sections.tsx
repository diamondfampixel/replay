import { getCollectionCards, getProductCards, getPublishedReviews, type StorefrontStore } from "@/lib/storefront/data";
import { normaliseSectionConfig, type SectionType } from "@/lib/storefront/sections";
import { ProductCard, SectionHeading, SectionShell, Stars, StoreLink } from "@/components/storefront/primitives";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { FaqList } from "@/components/storefront/faq-list";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

export type RenderedSection = {
  id: string;
  type: string;
  visible: boolean;
  config: Record<string, unknown>;
};

/**
 * Renders one stored section. Every section type resolves its own data on the
 * server, so a section added by the AI or the visual editor is live on the next
 * request with no code change.
 */
export async function SectionRenderer({
  section,
  store,
  preview = false,
}: {
  section: RenderedSection;
  store: StorefrontStore;
  preview?: boolean;
}) {
  const config = normaliseSectionConfig(section.type, section.config) as Record<string, never>;
  const type = section.type as SectionType;
  const s = store.slug;

  switch (type) {
    case "announcement": {
      const backgrounds: Record<string, string> = {
        ink: "bg-ink-900 text-white",
        brand: "bg-[var(--store-primary)] text-white",
        muted: "bg-ink-100 text-ink-800",
      };
      return (
        <div className={cn("px-5 py-2 text-center text-[12.5px]", backgrounds[config.background] ?? backgrounds.ink)}>
          {config.link ? (
            <StoreLink href={config.link} storeSlug={s} className="hover:underline">
              {config.text}
            </StoreLink>
          ) : (
            config.text
          )}
        </div>
      );
    }

    case "hero": {
      const heights: Record<string, string> = {
        small: "py-16 sm:py-20",
        medium: "py-24 sm:py-32",
        large: "py-28 sm:py-44",
      };
      const styles: Record<string, React.CSSProperties> = {
        white: { background: "var(--st-bg)", color: "var(--st-fg)" },
        muted: { background: "var(--st-surface-alt)", color: "var(--st-fg)" },
        brand: { background: "var(--st-accent)", color: "var(--st-accent-fg)" },
      };
      const centered = config.align === "center";
      const hasImage = Boolean(config.imageUrl);
      return (
        <section
          className={cn("st-reveal relative overflow-hidden", heights[config.height] ?? heights.large)}
          style={styles[config.background] ?? styles.muted}
        >
          {config.imageUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={config.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
              <div
                className="absolute inset-0"
                style={{
                  background: centered
                    ? "linear-gradient(to top, rgba(10,10,10,0.62), rgba(10,10,10,0.22))"
                    : "linear-gradient(to right, rgba(10,10,10,0.68), rgba(10,10,10,0.25) 55%, transparent)",
                }}
              />
            </>
          )}
          <div className={cn("relative mx-auto max-w-6xl px-5", centered && "text-center")} style={hasImage ? { color: "#fff" } : undefined}>
            <h1
              className={cn("st-display max-w-3xl text-[34px] leading-[1.05] sm:text-[54px]", centered && "mx-auto")}
              style={{ letterSpacing: "var(--st-heading-spacing)", textTransform: "var(--st-heading-transform)" as React.CSSProperties["textTransform"] }}
            >
              {config.headline}
            </h1>
            {config.subheadline && (
              <p className={cn("mt-5 max-w-xl text-[16px] leading-relaxed", centered && "mx-auto", !hasImage && "st-muted")} style={hasImage ? { opacity: 0.92 } : undefined}>
                {config.subheadline}
              </p>
            )}
            <div className={cn("mt-8 flex flex-wrap gap-3", centered && "justify-center")}>
              {config.ctaLabel && (
                <StoreLink href={config.ctaHref || "/shop"} storeSlug={s} className="st-btn">
                  {config.ctaLabel}
                </StoreLink>
              )}
              {config.secondaryCtaLabel && (
                <StoreLink
                  href={config.secondaryCtaHref || "/pages/about"}
                  storeSlug={s}
                  className={cn("st-btn st-btn-secondary")}
                  style={hasImage ? { color: "#fff", borderColor: "rgba(255,255,255,0.6)" } : undefined}
                >
                  {config.secondaryCtaLabel}
                </StoreLink>
              )}
            </div>
          </div>
        </section>
      );
    }

    case "imageHero":
      return (
        <section className="st-reveal relative min-h-[420px] overflow-hidden sm:min-h-[560px]" style={{ background: "var(--st-contrast-bg)" }}>
          {config.imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={config.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black" style={{ opacity: (Number(config.overlay) || 30) / 100 }} />
          <div
            className={cn(
              "relative mx-auto flex min-h-[420px] max-w-6xl flex-col justify-center px-5 py-16 text-white sm:min-h-[560px]",
              config.align === "center" && "items-center text-center",
            )}
          >
            <h2
              className="st-display max-w-2xl text-[32px] leading-[1.06] sm:text-[48px]"
              style={{ letterSpacing: "var(--st-heading-spacing)", textTransform: "var(--st-heading-transform)" as React.CSSProperties["textTransform"] }}
            >
              {config.headline}
            </h2>
            {config.subheadline && <p className="mt-4 max-w-lg text-[16px] opacity-90">{config.subheadline}</p>}
            {config.ctaLabel && (
              <StoreLink
                href={config.ctaHref || "/shop"}
                storeSlug={s}
                className="st-btn mt-7 w-fit"
                style={{ background: "#fff", color: "#111", borderColor: "#fff" }}
              >
                {config.ctaLabel}
              </StoreLink>
            )}
          </div>
        </section>
      );

    case "featuredProducts":
    case "productGrid": {
      const limit = Number(config.limit) || 4;
      const products = await getProductCards(store.id, {
        source: type === "productGrid" ? "newest" : config.source,
        collectionSlug: config.collectionSlug,
        productIds: config.productIds,
        limit,
      });
      if (!products.length && !preview) return null;

      const columns = type === "productGrid" ? Number(config.columns) || 4 : 4;
      return (
        <SectionShell background={config.background} spacing={config.spacing}>
          <SectionHeading title={config.heading} subtitle={config.subheading} />
          {products.length === 0 ? (
            <p className="rounded-md border border-dashed border-ink-300 px-4 py-8 text-center text-[13px] text-ink-500">
              No products match this section yet.
            </p>
          ) : (
            <div
              className={cn(
                "grid gap-x-5 gap-y-8",
                columns === 2 ? "grid-cols-2"
                : columns === 3 ? "grid-cols-2 sm:grid-cols-3"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
              )}
            >
              {products.map((product) => (
                <ProductCard key={product.id} product={product} storeSlug={s} currency={store.currency} />
              ))}
            </div>
          )}
        </SectionShell>
      );
    }

    case "collectionGrid": {
      const collections = await getCollectionCards(store.id, config.collectionSlugs ?? []);
      if (!collections.length && !preview) return null;
      return (
        <SectionShell background={config.background} spacing={config.spacing}>
          <SectionHeading title={config.heading} />
          {collections.length === 0 ? (
            <p className="rounded-md border border-dashed border-ink-300 px-4 py-8 text-center text-[13px] text-ink-500">
              No collections to show yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((collection) => (
                <StoreLink
                  key={collection.id}
                  href={`/collections/${collection.slug}`}
                  storeSlug={s}
                  className="group relative block overflow-hidden rounded-md bg-ink-100"
                >
                  <div className="aspect-[4/3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={collection.imageUrl ?? "/placeholder.svg"}
                      alt={collection.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/75 to-transparent p-4">
                    <h3 className="text-[15px] font-medium text-white">{collection.title}</h3>
                    {collection.description && (
                      <p className="mt-0.5 line-clamp-1 text-[12.5px] text-white/75">{collection.description}</p>
                    )}
                  </div>
                </StoreLink>
              ))}
            </div>
          )}
        </SectionShell>
      );
    }

    case "text":
      return (
        <SectionShell background={config.background} spacing={config.spacing}>
          <div className={cn("max-w-2xl", config.align === "center" && "mx-auto text-center")}>
            <SectionHeading title={config.heading} align={config.align} />
            <p className="whitespace-pre-line text-[15px] leading-relaxed opacity-80">{config.body}</p>
          </div>
        </SectionShell>
      );

    case "imageText":
      return (
        <SectionShell background={config.background} spacing={config.spacing}>
          <div className={cn("grid items-center gap-8 lg:grid-cols-2", config.imagePosition === "left" && "lg:[&>*:first-child]:order-2")}>
            <div>
              {config.heading && (
                <h2 className="st-heading-transform text-[24px] leading-[1.1] sm:text-[30px]">{config.heading}</h2>
              )}
              <p className="st-muted mt-4 whitespace-pre-line text-[15.5px] leading-relaxed">{config.body}</p>
              {config.ctaLabel && (
                <StoreLink href={config.ctaHref || "/shop"} storeSlug={s} className="st-btn st-btn-secondary st-btn-sm mt-6">
                  {config.ctaLabel}
                </StoreLink>
              )}
            </div>
            <div className="st-product-media st-radius overflow-hidden" style={{ background: "var(--st-surface-alt)", aspectRatio: "4 / 3" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={config.imageUrl ?? "/placeholder.svg"} alt="" loading="lazy" className="size-full object-cover" />
            </div>
          </div>
        </SectionShell>
      );

    case "benefits": {
      const items = (config.items ?? []) as Array<{ title: string; body: string }>;
      if (!items.length && !preview) return null;
      return (
        <SectionShell background={config.background} spacing={config.spacing}>
          <SectionHeading title={config.heading} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <div key={index} className="border-t border-current/15 pt-4">
                <h3 className="text-[14.5px] font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed opacity-70">{item.body}</p>
              </div>
            ))}
            {!items.length && (
              <p className="text-[13px] opacity-60">Add benefit items in the editor.</p>
            )}
          </div>
        </SectionShell>
      );
    }

    case "testimonials": {
      const items = (config.items ?? []) as Array<{ quote: string; author: string; role: string }>;
      if (!items.length) {
        // Never invent testimonials — an empty section stays empty on the live site.
        return preview ? (
          <SectionShell background={config.background} spacing={config.spacing}>
            <SectionHeading title={config.heading} />
            <p className="rounded-md border border-dashed border-ink-300 px-4 py-8 text-center text-[13px] text-ink-500">
              No testimonials added. Add real quotes in the editor — this section stays hidden on the
              live store until you do.
            </p>
          </SectionShell>
        ) : null;
      }
      return (
        <SectionShell background={config.background} spacing={config.spacing}>
          <SectionHeading title={config.heading} align="center" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <blockquote key={index} className="rounded-md border border-current/12 p-5">
                <p className="text-[14px] leading-relaxed">“{item.quote}”</p>
                <footer className="mt-3 text-[12.5px] opacity-65">
                  {item.author}{item.role && `, ${item.role}`}
                </footer>
              </blockquote>
            ))}
          </div>
        </SectionShell>
      );
    }

    case "reviews": {
      const reviews = await getPublishedReviews(store.id, Number(config.limit) || 3, Number(config.minRating) || 4);
      if (!reviews.length && !preview) return null;
      return (
        <SectionShell background={config.background} spacing={config.spacing}>
          <SectionHeading title={config.heading} align="center" />
          {reviews.length === 0 ? (
            <p className="rounded-md border border-dashed border-ink-300 px-4 py-8 text-center text-[13px] text-ink-500">
              No published reviews match yet. This section pulls real reviews from your catalog.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review) => (
                <figure key={review.id} className="rounded-md border border-current/12 p-5">
                  <Stars rating={review.rating} />
                  {review.title && <h3 className="mt-2 text-[14px] font-semibold">{review.title}</h3>}
                  <blockquote className="mt-1.5 text-[13.5px] leading-relaxed opacity-80">{review.body}</blockquote>
                  <figcaption className="mt-3 flex flex-wrap items-center gap-x-2 text-[12px] opacity-60">
                    <span>{review.authorName}</span>
                    {review.verified && <span>· Verified purchase</span>}
                    <span>· {formatDate(review.createdAt)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </SectionShell>
      );
    }

    case "faq": {
      const items = (config.items ?? []) as Array<{ q: string; a: string }>;
      if (!items.length && !preview) return null;
      return (
        <SectionShell background={config.background} spacing={config.spacing}>
          <div className="mx-auto max-w-2xl">
            <SectionHeading title={config.heading} align="center" />
            <FaqList items={items} />
          </div>
        </SectionShell>
      );
    }

    case "newsletter":
      return (
        <SectionShell background={config.background} spacing={config.spacing}>
          <div className="mx-auto max-w-md text-center">
            <SectionHeading title={config.heading} subtitle={config.body} align="center" className="mb-5" />
            <NewsletterForm storeSlug={s} buttonLabel={config.buttonLabel} />
          </div>
        </SectionShell>
      );

    case "customBanner":
      return (
        <SectionShell background={config.background} spacing={config.spacing}>
          <div className="st-radius flex flex-wrap items-center justify-between gap-4 border border-current/15 px-7 py-7">
            <div>
              <h2 className="st-heading-transform text-[20px] leading-tight">{config.heading}</h2>
              {config.body && <p className="st-muted mt-1.5 text-[14.5px]">{config.body}</p>}
            </div>
            {config.ctaLabel && (
              <StoreLink href={config.ctaHref || "/shop"} storeSlug={s} className="st-btn st-btn-sm">
                {config.ctaLabel}
              </StoreLink>
            )}
          </div>
        </SectionShell>
      );

    default:
      return null;
  }
}
