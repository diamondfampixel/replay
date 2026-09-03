import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionConfig } from "@/lib/storefront/sections";
import { getCollectionCards, getFeaturedProduct, getProductCards, type StorefrontStore } from "@/lib/storefront/data";
import { SectionShell, Stagger, staggerIndex, type ShellProps } from "@/components/storefront/section-shell";
import { Media, hasMedia } from "@/components/storefront/media";
import { EmptyNote, Eyebrow, Price, ProductCard, SectionHeading, StoreLink, gridClass } from "@/components/storefront/primitives";

type Shell = Omit<ShellProps, "design" | "children" | "type">;
type Ctx = { s: string; store: StorefrontStore; shell: Shell; preview: boolean };

function cardProps(store: StorefrontStore) {
  return { storeSlug: store.slug, currency: store.currency, showRating: store.theme.cards.showRating, priceEmphasis: store.theme.cards.priceEmphasis };
}

export async function FeaturedProducts({ c, ctx, type }: { c: SectionConfig<"featuredProducts">; ctx: Ctx; type: "featuredProducts" | "productGrid" }) {
  const { store, s, shell, preview } = ctx;
  const grid = type === "productGrid";
  const products = await getProductCards(store.id, {
    source: grid ? "newest" : c.source,
    collectionSlug: c.collectionSlug,
    productIds: c.productIds,
    limit: Number(c.limit) || 4,
  });
  if (!products.length && !preview) return null;
  const layout = grid ? "grid" : c.layout;
  const action = c.ctaLabel ? (
    <StoreLink href={c.ctaHref || "/shop"} storeSlug={s} className="st-btn st-btn-underline text-[14px]">{c.ctaLabel} →</StoreLink>
  ) : null;

  return (
    <SectionShell {...shell} type={type} design={c.design}>
      <SectionHeading title={c.heading} subtitle={grid ? undefined : c.subheading} action={action} />
      {products.length === 0 ? (
        <EmptyNote>No products match this section yet.</EmptyNote>
      ) : layout === "carousel" ? (
        <Stagger className="st-carousel">
          {products.map((p, i) => <ProductCard key={p.id} product={p} {...cardProps(store)} style={staggerIndex(i)} />)}
        </Stagger>
      ) : layout === "asymmetric" ? (
        <Stagger className="st-asym">
          {products.map((p, i) => <ProductCard key={p.id} product={p} {...cardProps(store)} style={staggerIndex(i)} />)}
        </Stagger>
      ) : layout === "editorial" ? (
        <Stagger className="st-editorial-grid">
          {products.slice(0, 3).map((p, i) => <ProductCard key={p.id} product={p} {...cardProps(store)} style={staggerIndex(i)} />)}
        </Stagger>
      ) : layout === "list" ? (
        <Stagger as="ul" className="st-lines-y border-y" style={{ borderColor: "var(--st-border)" }}>
          {products.map((p, i) => (
            <li key={p.id} style={staggerIndex(i)}>
              <StoreLink href={`/products/${p.slug}`} storeSlug={s} className="group flex items-center gap-5 py-4">
                <div className="st-radius-image size-20 shrink-0 overflow-hidden" style={{ background: "var(--st-surface-alt)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl ?? "/placeholder.svg"} alt="" loading="lazy" className="size-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="st-h-xs group-hover:underline">{p.title}</h3>
                  <Price price={p.price} compareAtPrice={p.compareAtPrice} currency={store.currency} className="st-muted mt-1 text-[14px]" />
                </div>
                <ArrowRight className="size-4 shrink-0 opacity-50 transition-transform group-hover:translate-x-1" />
              </StoreLink>
            </li>
          ))}
        </Stagger>
      ) : (
        <Stagger className={gridClass(Number(c.columns) || 4, c.mobileColumns)}>
          {products.map((p, i) => <ProductCard key={p.id} product={p} {...cardProps(store)} style={staggerIndex(i)} />)}
        </Stagger>
      )}
    </SectionShell>
  );
}

export async function FeaturedProduct({ c, ctx }: { c: SectionConfig<"featuredProduct">; ctx: Ctx }) {
  const { store, s, shell, preview } = ctx;
  const product = await getFeaturedProduct(store.id, c.productId);
  if (!product) {
    return preview ? (
      <SectionShell {...shell} type="featuredProduct" design={c.design}>
        <EmptyNote>Choose a product for this section in the panel on the right.</EmptyNote>
      </SectionShell>
    ) : null;
  }
  const heading = c.heading || product.title;
  const body = c.body || product.description || "";
  const image = { url: product.images[0]?.url ?? null, alt: product.images[0]?.alt ?? product.title, focalX: 50, focalY: 50, overlay: 0, mobileUrl: null };
  const cta = (
    <StoreLink href={`/products/${product.slug}`} storeSlug={s} className="st-btn mt-7">
      {c.ctaLabel || "View product"}
    </StoreLink>
  );
  const priceLine = <Price price={product.price} compareAtPrice={product.compareAtPrice} currency={store.currency} className="mt-3 text-[18px]" emphasis="strong" />;

  if (c.layout === "poster") {
    return (
      <SectionShell {...shell} type="featuredProduct" design={{ ...c.design, scheme: "contrast", paddingTop: "none", paddingBottom: "none" }} bleed className="relative min-h-[60vh] overflow-hidden">
        <Media media={{ ...image, overlay: 45 }} fill />
        <div className="st-bleed-inner relative flex min-h-[60vh] flex-col justify-end py-14 text-white" style={{ maxWidth: "var(--st-max-width)" }}>
          <Eyebrow className="text-white/80">{c.eyebrow}</Eyebrow>
          <h2 className="st-heading-transform st-h-xl max-w-2xl">{heading}</h2>
          {body && <p className="st-lead mt-4 max-w-lg" style={{ color: "rgba(255,255,255,0.85)" }}>{body.slice(0, 240)}</p>}
          <div className="text-white">{priceLine}</div>
          <StoreLink href={`/products/${product.slug}`} storeSlug={s} className="st-btn st-btn-inverse mt-6 w-fit">{c.ctaLabel || "View product"}</StoreLink>
        </div>
      </SectionShell>
    );
  }
  if (c.layout === "editorial") {
    return (
      <SectionShell {...shell} type="featuredProduct" design={c.design}>
        <Media media={image} ratio="wide" className="st-zoom" />
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h2 className="st-heading-transform st-h-lg">{heading}</h2>
            {priceLine}
          </div>
          <div>
            {body && <p className="st-muted st-lead whitespace-pre-line">{body.slice(0, 600)}</p>}
            {cta}
          </div>
        </div>
      </SectionShell>
    );
  }
  return (
    <SectionShell {...shell} type="featuredProduct" design={c.design}>
      <div className={cn("grid items-center gap-10 lg:grid-cols-2 lg:gap-16", c.imagePosition === "right" && "lg:[&>*:first-child]:order-2")}>
        <Media media={image} ratio="portrait" className="st-zoom" />
        <div>
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h2 className="st-heading-transform st-h-lg">{heading}</h2>
          {priceLine}
          {body && <p className="st-muted st-lead mt-5 max-w-lg whitespace-pre-line">{body.slice(0, 600)}</p>}
          {cta}
        </div>
      </div>
    </SectionShell>
  );
}

export async function CollectionGrid({ c, ctx }: { c: SectionConfig<"collectionGrid">; ctx: Ctx }) {
  const { store, s, shell, preview } = ctx;
  const collections = await getCollectionCards(store.id, c.collectionSlugs ?? []);
  if (!collections.length && !preview) return null;
  const cols = Number(c.columns) || 3;
  const image = (col: (typeof collections)[number], ratio: string, className?: string) => (
    <Media media={{ url: col.imageUrl, alt: col.title, focalX: 50, focalY: 50, overlay: 0, mobileUrl: null }} ratio={ratio} className={cn("st-zoom", className)} />
  );

  return (
    <SectionShell {...shell} type="collectionGrid" design={c.design}>
      <SectionHeading title={c.heading} />
      {collections.length === 0 ? (
        <EmptyNote>No collections to show yet.</EmptyNote>
      ) : c.layout === "mosaic" && collections.length >= 3 ? (
        <Stagger className="st-mosaic">
          {collections.slice(0, 5).map((col, i) => (
            <StoreLink key={col.id} href={`/collections/${col.slug}`} storeSlug={s} className="st-card-hover group relative block overflow-hidden st-radius-image" style={staggerIndex(i)}>
              <Media media={{ url: col.imageUrl, alt: col.title, focalX: 50, focalY: 50, overlay: 0, mobileUrl: null }} fill className="st-zoom !rounded-none" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 text-white">
                <h3 className="st-h-xs text-white">{col.title}</h3>
              </div>
            </StoreLink>
          ))}
        </Stagger>
      ) : c.layout === "list" ? (
        <Stagger as="ul" className="st-lines-y border-y" style={{ borderColor: "var(--st-border)" }}>
          {collections.map((col, i) => (
            <li key={col.id} style={staggerIndex(i)}>
              <StoreLink href={`/collections/${col.slug}`} storeSlug={s} className="group flex items-center gap-5 py-5">
                <div className="st-radius-image size-16 shrink-0 overflow-hidden">{image(col, "square", "!rounded-none size-full")}</div>
                <div className="min-w-0 flex-1">
                  <h3 className="st-h-sm group-hover:underline">{col.title}</h3>
                  {col.description && <p className="st-muted mt-0.5 line-clamp-1 text-[13.5px]">{col.description}</p>}
                </div>
                <span className="st-muted st-small shrink-0">{col.productCount} items</span>
                <ArrowRight className="size-4 shrink-0 opacity-50 transition-transform group-hover:translate-x-1" />
              </StoreLink>
            </li>
          ))}
        </Stagger>
      ) : c.layout === "circles" ? (
        <Stagger className="st-jc flex flex-wrap gap-8">
          {collections.map((col, i) => (
            <StoreLink key={col.id} href={`/collections/${col.slug}`} storeSlug={s} className="group flex w-32 flex-col items-center text-center sm:w-40" style={staggerIndex(i)}>
              <div className="st-zoom size-32 overflow-hidden rounded-full sm:size-40" style={{ background: "var(--st-surface-alt)" }}>
                {image(col, "square", "!rounded-full size-full")}
              </div>
              <h3 className="st-h-xs mt-4 group-hover:underline">{col.title}</h3>
            </StoreLink>
          ))}
        </Stagger>
      ) : (
        <Stagger className={cn("grid st-grid-gap", cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3")}>
          {collections.map((col, i) => (
            <StoreLink key={col.id} href={`/collections/${col.slug}`} storeSlug={s} className="st-card-hover group relative block overflow-hidden st-radius-image" style={staggerIndex(i)}>
              {image(col, "landscape", "!rounded-none")}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 text-white">
                <h3 className="st-h-xs text-white">{col.title}</h3>
                {col.description && <p className="mt-0.5 line-clamp-1 text-[12.5px] text-white/75">{col.description}</p>}
              </div>
            </StoreLink>
          ))}
        </Stagger>
      )}
    </SectionShell>
  );
}

export async function CollectionHero({ c, ctx }: { c: SectionConfig<"collectionHero">; ctx: Ctx }) {
  const { store, s, shell, preview } = ctx;
  const [col] = c.collectionSlug ? await getCollectionCards(store.id, [c.collectionSlug]) : [];
  if (!col) {
    return preview ? (
      <SectionShell {...shell} type="collectionHero" design={c.design}><EmptyNote>Choose a collection for this section.</EmptyNote></SectionShell>
    ) : null;
  }
  const headline = c.headline || col.title;
  const body = c.body || col.description || "";
  const media = hasMedia(c.media) ? c.media : { url: col.imageUrl, alt: col.title, focalX: 50, focalY: 50, overlay: 0, mobileUrl: null };
  const href = `/collections/${col.slug}`;

  if (c.layout === "text") {
    return (
      <SectionShell {...shell} type="collectionHero" design={c.design}>
        <div className="max-w-2xl">
          <Eyebrow>Collection</Eyebrow>
          <h2 className="st-heading-transform st-h-lg">{headline}</h2>
          {body && <p className="st-muted st-lead mt-4">{body}</p>}
          <StoreLink href={href} storeSlug={s} className="st-btn mt-7">{c.ctaLabel || "Shop the collection"}</StoreLink>
        </div>
      </SectionShell>
    );
  }
  if (c.layout === "split") {
    return (
      <SectionShell {...shell} type="collectionHero" design={c.design}>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Media media={media} ratio="landscape" className="st-zoom" />
          <div>
            <Eyebrow>Collection · {col.productCount} items</Eyebrow>
            <h2 className="st-heading-transform st-h-lg">{headline}</h2>
            {body && <p className="st-muted st-lead mt-4 max-w-md">{body}</p>}
            <StoreLink href={href} storeSlug={s} className="st-btn mt-7">{c.ctaLabel || "Shop the collection"}</StoreLink>
          </div>
        </div>
      </SectionShell>
    );
  }
  return (
    <SectionShell {...shell} type="collectionHero" design={{ ...c.design, scheme: "contrast", paddingTop: "none", paddingBottom: "none" }} bleed className="relative min-h-[48vh] overflow-hidden">
      <Media media={{ ...media, overlay: Math.max(media.overlay, 40) }} fill />
      <div className="st-bleed-inner relative flex min-h-[48vh] flex-col justify-end py-12 text-white" style={{ maxWidth: "var(--st-max-width)" }}>
        <Eyebrow className="text-white/80">Collection · {col.productCount} items</Eyebrow>
        <h2 className="st-heading-transform st-h-xl max-w-2xl">{headline}</h2>
        {body && <p className="st-lead mt-3 max-w-lg" style={{ color: "rgba(255,255,255,0.85)" }}>{body}</p>}
        <StoreLink href={href} storeSlug={s} className="st-btn st-btn-inverse mt-6 w-fit">{c.ctaLabel || "Shop the collection"}</StoreLink>
      </div>
    </SectionShell>
  );
}
