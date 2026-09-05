import { cn } from "@/lib/utils";
import type { SectionConfig } from "@/lib/storefront/sections";
import type { StorefrontStore } from "@/lib/storefront/data";
import { SectionShell, Stagger, staggerIndex, type ShellProps } from "@/components/storefront/section-shell";
import { Media, hasMedia } from "@/components/storefront/media";
import { EmptyNote, Eyebrow, SectionHeading, StoreLink } from "@/components/storefront/primitives";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { Countdown } from "@/components/storefront/countdown";

type Shell = Omit<ShellProps, "design" | "children" | "type">;
type Ctx = { s: string; store: StorefrontStore; shell: Shell; preview: boolean };

// ---------------------------------------------------------------------------
// Premium sections. These exist so a paid theme is structurally different from
// an included one: art-directed image sequences, structured product detail,
// and a timed launch — none of which an included theme can reach by changing
// colours or compositions.
// ---------------------------------------------------------------------------

export function Lookbook({ c, ctx }: { c: SectionConfig<"lookbook">; ctx: Ctx }) {
  const { shell, preview, s } = ctx;
  const items = c.items ?? [];
  if (!items.length && !preview) return null;

  const look = (it: (typeof items)[number], i: number, extra?: string) => {
    const body = (
      <figure className={cn("st-zoom", extra)} style={staggerIndex(i)}>
        <Media media={it.media} ratio={it.size === "small" ? "square" : it.size === "medium" ? "portrait" : "tall"} className="st-radius-image overflow-hidden" />
        {(it.caption || it.productSlug) && (
          <figcaption className="mt-3 flex items-baseline justify-between gap-3">
            {it.caption && <span className="st-body st-muted text-[13.5px]">{it.caption}</span>}
            {it.productSlug && <span className="st-eyebrow shrink-0 underline underline-offset-4">Shop the look</span>}
          </figcaption>
        )}
      </figure>
    );
    return it.productSlug ? (
      <StoreLink key={i} href={`/products/${it.productSlug}`} storeSlug={s} className="block">{body}</StoreLink>
    ) : (
      <div key={i}>{body}</div>
    );
  };

  return (
    <SectionShell {...shell} type="lookbook" design={c.design}>
      <SectionHeading title={c.heading} subtitle={c.intro} />
      {!items.length ? (
        <EmptyNote>Add looks in the editor — each takes an image, a caption and an optional product.</EmptyNote>
      ) : c.layout === "filmstrip" ? (
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-7 sm:px-7" style={{ scrollSnapType: "x mandatory" }}>
          <Stagger className="flex gap-5 pb-2">
            {items.map((it, i) => (
              <div key={i} className="shrink-0" style={{ width: it.size === "small" ? "min(52vw, 240px)" : it.size === "medium" ? "min(70vw, 360px)" : "min(84vw, 520px)", scrollSnapAlign: "start" }}>
                {look(it, i)}
              </div>
            ))}
          </Stagger>
        </div>
      ) : c.layout === "stacked" ? (
        <div className="space-y-12 sm:space-y-20">
          {items.map((it, i) => (
            <div key={i} className={cn("mx-auto", it.size === "small" ? "max-w-md" : it.size === "medium" ? "max-w-2xl" : "max-w-none")} data-reveal="fade">
              {look(it, 0)}
            </div>
          ))}
        </div>
      ) : (
        <Stagger className="grid gap-x-6 gap-y-10 sm:grid-cols-6 lg:grid-cols-12">
          {items.map((it, i) => {
            const span = it.size === "small" ? "sm:col-span-2 lg:col-span-3" : it.size === "medium" ? "sm:col-span-3 lg:col-span-5" : "sm:col-span-6 lg:col-span-7";
            const offset = i % 3 === 1 ? "lg:mt-16" : i % 3 === 2 ? "lg:-mt-8" : "";
            return <div key={i} className={cn(span, offset)}>{look(it, i)}</div>;
          })}
        </Stagger>
      )}
    </SectionShell>
  );
}

export function SpecSheet({ c, ctx }: { c: SectionConfig<"specSheet">; ctx: Ctx }) {
  const { shell, preview } = ctx;
  const rows = c.rows ?? [];
  if (!rows.length && !preview) return null;
  const columns = (c.columns ?? []).filter(Boolean);

  return (
    <SectionShell {...shell} type="specSheet" design={c.design}>
      <div className={cn("grid gap-10", c.layout === "table" && "lg:grid-cols-[1fr_2fr]")}>
        <div>
          <SectionHeading title={c.heading} subtitle={c.intro} align="left" />
        </div>
        {!rows.length ? (
          <EmptyNote>Add rows in the editor — materials, ingredients, dimensions, care.</EmptyNote>
        ) : c.layout === "cards" ? (
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row, i) => (
              <div key={i} className="st-radius-card border p-5" style={{ ...staggerIndex(i), borderColor: "var(--st-border)", background: "var(--st-surface-alt)" }}>
                <p className="st-eyebrow" style={{ color: "var(--st-accent)" }}>{row.label}</p>
                <p className="st-h-sm mt-2">{row.value}</p>
                {row.detail && <p className="st-muted st-body mt-2 text-[13.5px]">{row.detail}</p>}
              </div>
            ))}
          </Stagger>
        ) : c.layout === "compare" && columns.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr>
                  <th className="st-eyebrow py-3 pr-4 font-medium" style={{ borderBottom: "1px solid var(--st-border-strong)" }}></th>
                  {columns.map((col) => (
                    <th key={col} className="st-h-sm py-3 pr-4 font-semibold" style={{ borderBottom: "1px solid var(--st-border-strong)" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const cells = row.value.split("|").map((v) => v.trim());
                  return (
                    <tr key={i}>
                      <th scope="row" className="st-muted py-3 pr-4 font-medium" style={{ borderBottom: "1px solid var(--st-border)" }}>{row.label}</th>
                      {columns.map((col, j) => (
                        <td key={col} className="py-3 pr-4" style={{ borderBottom: "1px solid var(--st-border)" }}>{cells[j] ?? cells[0] ?? ""}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <dl className="divide-y" style={{ borderColor: "var(--st-border)" }}>
            {rows.map((row, i) => (
              <div key={i} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-6" style={{ borderColor: "var(--st-border)" }}>
                <dt className="st-eyebrow pt-1" style={{ color: "var(--st-muted)" }}>{row.label}</dt>
                <dd>
                  <p className="st-body">{row.value}</p>
                  {row.detail && <p className="st-muted mt-1 text-[13px]">{row.detail}</p>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </SectionShell>
  );
}

export function DropCountdown({ c, ctx }: { c: SectionConfig<"dropCountdown">; ctx: Ctx }) {
  const { shell, store, s } = ctx;
  const poster = c.layout === "poster" && hasMedia(c.media);

  const content = (
    <div className={cn("relative", poster && "min-h-[60vh] flex items-end")}>
      <div className={cn("max-w-2xl", poster && "p-2 sm:p-4")}>
        {c.eyebrow && <Eyebrow>{c.eyebrow}</Eyebrow>}
        <h2 className="st-h-lg st-heading-transform mt-2">{c.headline}</h2>
        {c.body && <p className="st-body st-muted mt-3 max-w-xl">{c.body}</p>}
        <Countdown endsAt={c.endsAt} className="mt-6" />
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {c.ctaHref && c.ctaLabel && (
            <StoreLink href={c.ctaHref} storeSlug={s} className="st-btn st-btn-primary">{c.ctaLabel}</StoreLink>
          )}
          {c.showNewsletter && (
            <div className="min-w-[260px] flex-1">
              <NewsletterForm storeSlug={store.slug} buttonLabel={c.ctaHref ? "Notify me" : c.ctaLabel || "Notify me"} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <SectionShell {...shell} type="dropCountdown" design={c.design}>
      {poster ? (
        <div className="relative overflow-hidden st-radius-image">
          <Media media={c.media} fill className="absolute inset-0" lazy={false} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 20%, rgba(0,0,0,0.55) 100%)" }} aria-hidden="true" />
          <div className="relative p-6 text-white sm:p-10 [&_.st-muted]:text-white/80">{content}</div>
        </div>
      ) : (
        content
      )}
    </SectionShell>
  );
}
