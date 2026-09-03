import { Check, Clock, Gift, Heart, Leaf, Lock, Shield, Sparkles, Star, Truck, Undo2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionConfig } from "@/lib/storefront/sections";
import { SectionShell, Stagger, staggerIndex, type ShellProps } from "@/components/storefront/section-shell";
import { Media, hasMedia } from "@/components/storefront/media";
import { Parallax } from "@/components/storefront/motion";
import { EmptyNote, Eyebrow, SectionHeading, StoreLink } from "@/components/storefront/primitives";
import { FaqList } from "@/components/storefront/faq-list";
import type { ResolvedTheme } from "@/lib/storefront/theme";

type Shell = Omit<ShellProps, "design" | "children" | "type">;
type Ctx = { s: string; theme: ResolvedTheme; shell: Shell; preview: boolean };

export const ICONS: Record<string, LucideIcon> = { truck: Truck, undo: Undo2, shield: Shield, leaf: Leaf, star: Star, clock: Clock, lock: Lock, gift: Gift, heart: Heart, sparkles: Sparkles, check: Check };
export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? Check;
  return <Cmp className={className} aria-hidden="true" />;
}

const TEXT_SIZE: Record<string, string> = { md: "st-h-md", lg: "st-h-lg", xl: "st-h-xl" };

export function Text({ c, ctx }: { c: SectionConfig<"text">; ctx: Ctx }) {
  const { shell } = ctx;
  const centred = c.align === "center";
  if (c.layout === "statement") {
    return (
      <SectionShell {...shell} type="text" design={{ ...c.design, align: centred ? "center" : c.design.align }}>
        <div className={cn("max-w-4xl", centred && "mx-auto")}>
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <p className={cn("st-display st-heading-transform", TEXT_SIZE[c.size === "md" ? "lg" : "xl"])} style={{ fontWeight: "var(--st-heading-weight)" as React.CSSProperties["fontWeight"] }}>
            {c.heading || c.body}
          </p>
          {c.heading && c.body && <p className={cn("st-muted st-lead mt-6 max-w-xl whitespace-pre-line", centred && "mx-auto")}>{c.body}</p>}
        </div>
      </SectionShell>
    );
  }
  if (c.layout === "columns") {
    return (
      <SectionShell {...shell} type="text" design={c.design}>
        <div className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-5">
            <Eyebrow>{c.eyebrow}</Eyebrow>
            {c.heading && <h2 className={cn("st-heading-transform", TEXT_SIZE[c.size])}>{c.heading}</h2>}
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <p className="st-body whitespace-pre-line opacity-85">{c.body}</p>
          </div>
        </div>
      </SectionShell>
    );
  }
  return (
    <SectionShell {...shell} type="text" design={{ ...c.design, align: centred ? "center" : c.design.align }}>
      <div className={cn("max-w-2xl", centred && "mx-auto")}>
        <Eyebrow>{c.layout === "eyebrow" ? c.eyebrow || "About" : c.eyebrow}</Eyebrow>
        {c.heading && <h2 className={cn("st-heading-transform mb-5", TEXT_SIZE[c.size])}>{c.heading}</h2>}
        <p className="st-body whitespace-pre-line opacity-85">{c.body}</p>
      </div>
    </SectionShell>
  );
}

export function ImageText({ c, ctx }: { c: SectionConfig<"imageText">; ctx: Ctx }) {
  const { s, shell } = ctx;
  const left = c.imagePosition === "left";
  const copy = (
    <div>
      <Eyebrow>{c.eyebrow}</Eyebrow>
      {c.heading && <h2 className="st-heading-transform st-h-md">{c.heading}</h2>}
      {c.body && <p className="st-muted st-body mt-4 whitespace-pre-line">{c.body}</p>}
      {c.ctaLabel && (
        <StoreLink href={c.ctaHref || "/shop"} storeSlug={s} className="st-btn st-btn-secondary st-btn-sm mt-6">{c.ctaLabel}</StoreLink>
      )}
    </div>
  );
  const ratio = c.imageRatio === "inherit" ? "landscape" : c.imageRatio;

  if (c.layout === "stacked") {
    return (
      <SectionShell {...shell} type="imageText" design={c.design}>
        <Media media={c.media} ratio={c.imageRatio === "inherit" ? "wide" : c.imageRatio} className="st-zoom" />
        <div className="mx-auto mt-10 max-w-2xl">{copy}</div>
      </SectionShell>
    );
  }
  if (c.layout === "overlap") {
    return (
      <SectionShell {...shell} type="imageText" design={c.design}>
        <div className={cn("grid items-center lg:grid-cols-12", left ? "" : "")}>
          <div className={cn("lg:col-span-8 lg:row-start-1", left ? "lg:col-start-1" : "lg:col-start-5")}>
            <Media media={c.media} ratio={ratio} className="st-zoom" />
          </div>
          <div className={cn("st-surface st-radius-card st-shadow relative z-10 -mt-10 mx-4 border p-7 sm:p-9 lg:col-span-5 lg:row-start-1 lg:mx-0 lg:mt-0", left ? "lg:col-start-8" : "lg:col-start-1")} style={{ background: "var(--st-surface)", borderColor: "var(--st-border)" }}>
            {copy}
          </div>
        </div>
      </SectionShell>
    );
  }
  const wide = c.layout === "wideImage";
  const narrow = c.layout === "narrowImage";
  return (
    <SectionShell {...shell} type="imageText" design={c.design}>
      <div className={cn("grid items-center gap-8 lg:gap-14", wide ? "lg:grid-cols-5" : narrow ? "lg:grid-cols-5" : "lg:grid-cols-2", left && "lg:[&>*:first-child]:order-2")}>
        <div className={cn(wide ? "lg:col-span-2" : narrow ? "lg:col-span-3" : "")}>{copy}</div>
        <Media media={c.media} ratio={narrow ? (c.imageRatio === "inherit" ? "portrait" : c.imageRatio) : ratio} className={cn("st-zoom", wide ? "lg:col-span-3" : narrow ? "lg:col-span-2" : "")} />
      </div>
    </SectionShell>
  );
}

export function Gallery({ c, ctx }: { c: SectionConfig<"gallery">; ctx: Ctx }) {
  const { s, shell, preview } = ctx;
  const items = c.items.filter((i) => hasMedia(i.media));
  if (!items.length && !preview) return null;
  const cols = Number(c.columns) || 3;
  const ratio = c.ratio;
  const item = (it: (typeof items)[number], i: number, cls?: string, r = ratio) => {
    const inner = (
      <figure className={cn("st-zoom", cls)} style={staggerIndex(i)}>
        <Media media={it.media} ratio={r} />
        {it.caption && <figcaption className="st-muted st-small mt-2">{it.caption}</figcaption>}
      </figure>
    );
    return it.href ? <StoreLink key={i} href={it.href} storeSlug={s} className="block">{inner}</StoreLink> : <div key={i}>{inner}</div>;
  };
  return (
    <SectionShell {...shell} type="gallery" design={c.design}>
      <SectionHeading title={c.heading} />
      {!items.length ? (
        <EmptyNote>Add images to this gallery in the editor.</EmptyNote>
      ) : c.layout === "mosaic" ? (
        <Stagger className="st-mosaic">
          {items.slice(0, 8).map((it, i) => (
            <div key={i} className="st-zoom relative overflow-hidden st-radius-image" style={staggerIndex(i)}>
              <Media media={it.media} fill className="!rounded-none" />
              {it.caption && <span className="absolute bottom-2 left-2 st-badge bg-black/55 text-white">{it.caption}</span>}
            </div>
          ))}
        </Stagger>
      ) : c.layout === "masonry" ? (
        <Stagger className="st-masonry">{items.map((it, i) => item(it, i, undefined, i % 3 === 1 ? "square" : i % 3 === 2 ? "portrait" : "landscape"))}</Stagger>
      ) : c.layout === "strip" ? (
        <Stagger className="st-strip -mx-5 px-5 sm:-mx-7 sm:px-7">{items.map((it, i) => item(it, i, undefined, ratio === "inherit" ? "portrait" : ratio))}</Stagger>
      ) : (
        <Stagger className={cn("grid st-grid-gap", cols === 2 ? "grid-cols-2" : cols === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-3")}>
          {items.map((it, i) => item(it, i))}
        </Stagger>
      )}
    </SectionShell>
  );
}

const FULL_H: Record<string, string> = { auto: "min-h-[40vh]", small: "min-h-[36vh]", medium: "min-h-[56vh]", large: "min-h-[76vh]", screen: "min-h-[100svh]" };
export function FullImage({ c, ctx }: { c: SectionConfig<"fullImage">; ctx: Ctx }) {
  const { theme, shell, preview } = ctx;
  if (!hasMedia(c.media) && !preview) return null;
  const parallax = c.parallax && theme.motionConfig.parallax;
  return (
    <SectionShell {...shell} type="fullImage" design={{ ...c.design, paddingTop: "none", paddingBottom: "none" }} bleed>
      <div className={cn("relative overflow-hidden", FULL_H[c.height])}>
        {parallax ? <Parallax className="absolute inset-0"><Media media={c.media} fill /></Parallax> : <Media media={c.media} fill />}
      </div>
      {c.caption && <p className="st-muted st-small px-5 py-3 sm:px-7">{c.caption}</p>}
    </SectionShell>
  );
}

export function Benefits({ c, ctx }: { c: SectionConfig<"benefits">; ctx: Ctx }) {
  const { shell, preview } = ctx;
  const items = c.items ?? [];
  if (!items.length && !preview) return null;
  const cols = Number(c.columns) || 3;
  const gridCols = cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <SectionShell {...shell} type="benefits" design={c.design}>
      <SectionHeading title={c.heading} />
      {!items.length ? <EmptyNote>Add benefit items in the editor.</EmptyNote> : c.layout === "rows" ? (
        <Stagger as="ul" className="st-lines-y max-w-3xl border-t" style={{ borderColor: "var(--st-border)" }}>
          {items.map((item, i) => (
            <li key={i} className="grid gap-2 py-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-8" style={staggerIndex(i)}>
              <h3 className="st-h-sm">{item.title}</h3>
              <p className="st-muted st-body">{item.body}</p>
            </li>
          ))}
        </Stagger>
      ) : c.layout === "cards" ? (
        <Stagger className={cn("grid st-grid-gap", gridCols)}>
          {items.map((item, i) => (
            <div key={i} className="st-radius-card st-shadow border p-6" style={{ background: "var(--st-surface)", borderColor: "var(--st-border)", ...staggerIndex(i) }}>
              {item.icon && <span className="mb-4 inline-flex size-10 items-center justify-center rounded-full" style={{ background: "var(--st-surface-alt)", color: "var(--st-accent)" }}><Icon name={item.icon} className="size-4.5" /></span>}
              <h3 className="st-h-xs">{item.title}</h3>
              <p className="st-muted mt-2 text-[14px] leading-relaxed">{item.body}</p>
            </div>
          ))}
        </Stagger>
      ) : c.layout === "icons" ? (
        <Stagger className={cn("grid gap-8", gridCols)}>
          {items.map((item, i) => (
            <div key={i} className="flex gap-4" style={staggerIndex(i)}>
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center st-radius-sm" style={{ background: "var(--st-brand-bg)", color: "var(--st-brand-fg)" }}><Icon name={item.icon || "check"} className="size-4" /></span>
              <div>
                <h3 className="st-h-xs">{item.title}</h3>
                <p className="st-muted mt-1.5 text-[14px] leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </Stagger>
      ) : (
        <Stagger className={cn("grid gap-6", gridCols)}>
          {items.map((item, i) => (
            <div key={i} className="border-t pt-4" style={{ borderColor: "var(--st-border-strong)", ...staggerIndex(i) }}>
              <h3 className="st-h-xs">{item.title}</h3>
              <p className="st-muted mt-1.5 text-[14px] leading-relaxed">{item.body}</p>
            </div>
          ))}
        </Stagger>
      )}
    </SectionShell>
  );
}

export function Faq({ c, ctx }: { c: SectionConfig<"faq">; ctx: Ctx }) {
  const { shell, preview } = ctx;
  const items = c.items ?? [];
  if (!items.length && !preview) return null;
  if (c.layout === "twoColumn") {
    return (
      <SectionShell {...shell} type="faq" design={c.design}>
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4"><SectionHeading title={c.heading} className="mb-0 lg:sticky lg:top-24" /></div>
          <div className="lg:col-span-8"><FaqList items={items} /></div>
        </div>
      </SectionShell>
    );
  }
  return (
    <SectionShell {...shell} type="faq" design={c.design}>
      <div className="mx-auto max-w-2xl">
        <SectionHeading title={c.heading} align="center" />
        <FaqList items={items} />
      </div>
    </SectionShell>
  );
}
