import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { SectionConfig } from "@/lib/storefront/sections";
import { getPublishedReviews, type StorefrontStore } from "@/lib/storefront/data";
import { SectionShell, Stagger, staggerIndex, type ShellProps } from "@/components/storefront/section-shell";
import { Media, hasMedia } from "@/components/storefront/media";
import { EmptyNote, Eyebrow, SectionHeading, Stars, StoreLink } from "@/components/storefront/primitives";

type Shell = Omit<ShellProps, "design" | "children" | "type">;
type Ctx = { s: string; store: StorefrontStore; shell: Shell; preview: boolean };

export function Stats({ c, ctx }: { c: SectionConfig<"stats">; ctx: Ctx }) {
  const { shell, preview } = ctx;
  const items = c.items ?? [];
  if (!items.length && !preview) return null;
  const value = (v: string) => <span className="st-display st-h-lg tabular block" style={{ fontWeight: "var(--st-heading-weight)" as React.CSSProperties["fontWeight"] }}>{v}</span>;
  return (
    <SectionShell {...shell} type="stats" design={c.design}>
      <SectionHeading title={c.heading} />
      {!items.length ? <EmptyNote>Add real numbers in the editor.</EmptyNote> : c.layout === "inline" ? (
        <p className="st-display st-h-md st-jc flex flex-wrap items-baseline gap-x-6 gap-y-2">
          {items.map((it, i) => (
            <span key={i} className="inline-flex items-baseline gap-2"><span className="tabular">{it.value}</span><span className="st-muted text-[0.55em] font-normal">{it.label}</span></span>
          ))}
        </p>
      ) : c.layout === "grid" ? (
        <Stagger className="grid grid-cols-2 gap-8 lg:grid-cols-3">
          {items.map((it, i) => (
            <div key={i} className="border-t pt-5" style={{ borderColor: "var(--st-border-strong)", ...staggerIndex(i) }}>{value(it.value)}<p className="st-muted mt-1 text-[14px]">{it.label}</p></div>
          ))}
        </Stagger>
      ) : (
        <Stagger className="st-jc flex flex-wrap gap-x-14 gap-y-8">
          {items.map((it, i) => (
            <div key={i} style={staggerIndex(i)}>{value(it.value)}<p className="st-muted mt-1 text-[14px]">{it.label}</p></div>
          ))}
        </Stagger>
      )}
    </SectionShell>
  );
}

export function LogoList({ c, ctx }: { c: SectionConfig<"logoList">; ctx: Ctx }) {
  const { s, shell, preview } = ctx;
  const items = c.items.filter((i) => hasMedia(i.media) || i.name);
  if (!items.length && !preview) return null;
  const logo = (it: (typeof items)[number], i: number) => {
    const inner = hasMedia(it.media)
      /* eslint-disable-next-line @next/next/no-img-element */
      ? <img src={it.media.url!} alt={it.media.alt || it.name} loading="lazy" className="h-8 w-auto max-w-[140px] object-contain opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0" />
      : <span className="st-display text-[15px] opacity-70">{it.name}</span>;
    return it.href ? <StoreLink key={i} href={it.href} storeSlug={s} className="inline-flex items-center" style={staggerIndex(i)}>{inner}</StoreLink> : <span key={i} className="inline-flex items-center" style={staggerIndex(i)}>{inner}</span>;
  };
  return (
    <SectionShell {...shell} type="logoList" design={c.design}>
      {c.heading && <p className="st-eyebrow st-jc mb-6 flex">{c.heading}</p>}
      {!items.length ? <EmptyNote>Add logos in the editor.</EmptyNote> : c.layout === "marquee" ? (
        <div className="st-marquee"><div className="st-marquee-track items-center gap-16">{[0, 1].flatMap((copy) => items.map((it, i) => <span key={`${copy}-${i}`} aria-hidden={copy > 0}>{logo(it, i)}</span>))}</div></div>
      ) : c.layout === "grid" ? (
        <Stagger className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">{items.map((it, i) => <div key={i} className="flex items-center justify-center border p-5" style={{ borderColor: "var(--st-border)" }}>{logo(it, i)}</div>)}</Stagger>
      ) : (
        <Stagger className="st-jc flex flex-wrap items-center gap-x-12 gap-y-6">{items.map(logo)}</Stagger>
      )}
    </SectionShell>
  );
}

export function Quote({ c, ctx }: { c: SectionConfig<"quote">; ctx: Ctx }) {
  const { shell, preview } = ctx;
  if (!c.quote && !preview) return null;
  const attribution = (c.author || c.role) && (
    <footer className="st-muted mt-6 text-[14px]">{c.author}{c.role && <span> · {c.role}</span>}</footer>
  );
  if (c.layout === "card") {
    return (
      <SectionShell {...shell} type="quote" design={c.design}>
        <blockquote className="st-radius-card st-shadow mx-auto max-w-2xl border p-8 sm:p-10" style={{ background: "var(--st-surface)", borderColor: "var(--st-border)" }}>
          <p className="st-display st-h-sm leading-snug" style={{ fontWeight: 500 }}>“{c.quote || "Your quote here"}”</p>
          {attribution}
        </blockquote>
      </SectionShell>
    );
  }
  if (c.layout === "editorial") {
    return (
      <SectionShell {...shell} type="quote" design={c.design}>
        <div className={cn("grid gap-10 lg:grid-cols-12 lg:items-center")}>
          <blockquote className={cn(hasMedia(c.media) ? "lg:col-span-7" : "lg:col-span-10")}>
            <span className="st-display block text-[5rem] leading-[0.6] opacity-30" aria-hidden="true">“</span>
            <p className="st-display st-h-md mt-4 leading-snug" style={{ fontWeight: 500 }}>{c.quote || "Your quote here"}</p>
            {attribution}
          </blockquote>
          {hasMedia(c.media) && <Media media={c.media} ratio="portrait" className="lg:col-span-4 lg:col-start-9" />}
        </div>
      </SectionShell>
    );
  }
  return (
    <SectionShell {...shell} type="quote" design={{ ...c.design, align: "center" }}>
      <blockquote className="mx-auto max-w-3xl">
        <p className="st-display st-h-lg leading-tight" style={{ fontWeight: 500 }}>“{c.quote || "Your quote here"}”</p>
        {attribution}
      </blockquote>
    </SectionShell>
  );
}

export function Story({ c, ctx }: { c: SectionConfig<"story">; ctx: Ctx }) {
  const { shell, preview } = ctx;
  const items = c.items ?? [];
  if (!items.length && !preview) return null;
  return (
    <SectionShell {...shell} type="story" design={c.design}>
      <SectionHeading title={c.heading} />
      {!items.length ? <EmptyNote>Add chapters in the editor.</EmptyNote> : c.layout === "timeline" ? (
        <Stagger as="ul" className="relative ml-2 border-l pl-8" style={{ borderColor: "var(--st-border-strong)" }}>
          {items.map((it, i) => (
            <li key={i} className="relative pb-10 last:pb-0" style={staggerIndex(i)}>
              <span className="absolute -left-[2.35rem] top-1.5 size-3 rounded-full" style={{ background: "var(--st-accent)" }} aria-hidden="true" />
              <h3 className="st-h-sm">{it.title}</h3>
              {it.body && <p className="st-muted st-body mt-2 max-w-xl">{it.body}</p>}
              {hasMedia(it.media) && <Media media={it.media} ratio="wide" className="mt-4 max-w-xl" />}
            </li>
          ))}
        </Stagger>
      ) : c.layout === "steps" ? (
        <Stagger className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <div key={i} style={staggerIndex(i)}>
              <span className="st-eyebrow st-accent-font block" style={{ color: "var(--st-accent)" }}>{String(i + 1).padStart(2, "0")}</span>
              {hasMedia(it.media) && <Media media={it.media} ratio="landscape" className="my-4" />}
              <h3 className="st-h-sm mt-3">{it.title}</h3>
              {it.body && <p className="st-muted st-body mt-2">{it.body}</p>}
            </div>
          ))}
        </Stagger>
      ) : (
        <div className="space-y-16">
          {items.map((it, i) => (
            <div key={i} className={cn("grid items-center gap-8 lg:grid-cols-2 lg:gap-14", i % 2 === 1 && "lg:[&>*:first-child]:order-2")} data-reveal="slide" style={staggerIndex(0)}>
              <Media media={it.media} ratio="landscape" className="st-zoom" />
              <div>
                <Eyebrow>{String(i + 1).padStart(2, "0")}</Eyebrow>
                <h3 className="st-h-md">{it.title}</h3>
                {it.body && <p className="st-muted st-body mt-4 max-w-md">{it.body}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

export function Testimonials({ c, ctx }: { c: SectionConfig<"testimonials">; ctx: Ctx }) {
  const { shell, preview } = ctx;
  const items = (c.items ?? []).filter((i) => i.quote);
  if (!items.length) {
    // Never invent testimonials — an empty section stays empty on the live site.
    return preview ? (
      <SectionShell {...shell} type="testimonials" design={c.design}>
        <SectionHeading title={c.heading} />
        <EmptyNote>No testimonials added. Add real quotes in the editor — this section stays hidden on the live store until you do.</EmptyNote>
      </SectionShell>
    ) : null;
  }
  const card = (it: (typeof items)[number], i: number, big = false) => (
    <blockquote key={i} className={cn("st-radius-card border p-6", big && "p-8 sm:p-10")} style={{ background: "var(--st-surface)", borderColor: "var(--st-border)", ...staggerIndex(i) }}>
      <p className={cn(big ? "st-display st-h-sm leading-snug" : "text-[14.5px] leading-relaxed")}>“{it.quote}”</p>
      <footer className="st-muted mt-4 text-[12.5px]">{it.author}{it.role && `, ${it.role}`}</footer>
    </blockquote>
  );
  return (
    <SectionShell {...shell} type="testimonials" design={c.design}>
      <SectionHeading title={c.heading} align={c.layout === "single" ? "center" : undefined} />
      {c.layout === "single" ? (
        <div className="mx-auto max-w-2xl text-center">{card(items[0], 0, true)}</div>
      ) : c.layout === "marquee" ? (
        <div className="st-marquee"><div className="st-marquee-track items-stretch [&>*]:w-[320px] [&>*]:whitespace-normal">{[0, 1].flatMap((copy) => items.map((it, i) => <div key={`${copy}-${i}`} aria-hidden={copy > 0}>{card(it, i)}</div>))}</div></div>
      ) : c.layout === "editorial" ? (
        <Stagger as="ul" className="st-lines-y max-w-3xl border-t" style={{ borderColor: "var(--st-border)" }}>
          {items.map((it, i) => (
            <li key={i} className="py-8" style={staggerIndex(i)}>
              <p className="st-display st-h-sm leading-snug" style={{ fontWeight: 500 }}>“{it.quote}”</p>
              <footer className="st-muted mt-3 text-[13px]">{it.author}{it.role && ` · ${it.role}`}</footer>
            </li>
          ))}
        </Stagger>
      ) : (
        <Stagger className="grid st-grid-gap sm:grid-cols-2 lg:grid-cols-3">{items.map((it, i) => card(it, i))}</Stagger>
      )}
    </SectionShell>
  );
}

export async function Reviews({ c, ctx }: { c: SectionConfig<"reviews">; ctx: Ctx }) {
  const { store, shell, preview } = ctx;
  const reviews = await getPublishedReviews(store.id, Number(c.limit) || 3, Number(c.minRating) || 4);
  if (!reviews.length && !preview) return null;
  const figure = (review: (typeof reviews)[number], i: number, list = false) => (
    <figure key={review.id} className={cn(list ? "py-6" : "st-radius-card border p-5")} style={list ? staggerIndex(i) : { background: "var(--st-surface)", borderColor: "var(--st-border)", ...staggerIndex(i) }}>
      <Stars rating={review.rating} />
      {review.title && <h3 className="st-h-xs mt-2">{review.title}</h3>}
      <blockquote className="mt-1.5 text-[14px] leading-relaxed opacity-85">{review.body}</blockquote>
      <figcaption className="st-muted mt-3 flex flex-wrap items-center gap-x-2 text-[12px]">
        <span>{review.authorName}</span>
        {review.verified && <span>· Verified purchase</span>}
        <span>· {formatDate(review.createdAt)}</span>
        <span>· {review.productTitle}</span>
      </figcaption>
    </figure>
  );
  return (
    <SectionShell {...shell} type="reviews" design={c.design}>
      <SectionHeading title={c.heading} align={c.layout === "grid" ? "center" : undefined} />
      {reviews.length === 0 ? (
        <EmptyNote>No published reviews match yet. This section pulls real reviews from your catalog.</EmptyNote>
      ) : c.layout === "list" ? (
        <Stagger className="st-lines-y max-w-3xl border-y" style={{ borderColor: "var(--st-border)" }}>{reviews.map((r, i) => figure(r, i, true))}</Stagger>
      ) : (
        <Stagger className="grid st-grid-gap sm:grid-cols-2 lg:grid-cols-3">{reviews.map((r, i) => figure(r, i))}</Stagger>
      )}
    </SectionShell>
  );
}
