import { cn } from "@/lib/utils";
import type { SectionConfig } from "@/lib/storefront/sections";
import { SectionShell, Stagger, staggerIndex, type ShellProps } from "@/components/storefront/section-shell";
import { Media, hasMedia } from "@/components/storefront/media";
import { Eyebrow, SectionHeading, StoreLink } from "@/components/storefront/primitives";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { Icon } from "@/components/storefront/sections/content";

type Shell = Omit<ShellProps, "design" | "children" | "type">;
type Ctx = { s: string; shell: Shell };

export function Newsletter({ c, ctx }: { c: SectionConfig<"newsletter">; ctx: Ctx }) {
  const { s, shell } = ctx;
  const form = <NewsletterForm storeSlug={s} buttonLabel={c.buttonLabel} />;
  if (c.layout === "inline") {
    return (
      <SectionShell {...shell} type="newsletter" design={c.design}>
        <div className="grid items-center gap-6 lg:grid-cols-2">
          <div><h2 className="st-heading-transform st-h-md">{c.heading}</h2>{c.body && <p className="st-muted mt-2 text-[15px]">{c.body}</p>}</div>
          <div className="lg:justify-self-end lg:w-full lg:max-w-md">{form}</div>
        </div>
      </SectionShell>
    );
  }
  if (c.layout === "split") {
    return (
      <SectionShell {...shell} type="newsletter" design={c.design}>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Media media={c.media} ratio="landscape" />
          <div><Eyebrow>Newsletter</Eyebrow><h2 className="st-heading-transform st-h-md">{c.heading}</h2>{c.body && <p className="st-muted mt-3 text-[15px]">{c.body}</p>}<div className="mt-6">{form}</div></div>
        </div>
      </SectionShell>
    );
  }
  if (c.layout === "banner") {
    return (
      <SectionShell {...shell} type="newsletter" design={{ ...c.design, scheme: c.design.scheme === "base" ? "contrast" : c.design.scheme }}>
        <div className="grid items-end gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7"><h2 className="st-heading-transform st-h-xl">{c.heading}</h2>{c.body && <p className="st-muted mt-3 max-w-md text-[15px]">{c.body}</p>}</div>
          <div className="lg:col-span-5">{form}</div>
        </div>
      </SectionShell>
    );
  }
  return (
    <SectionShell {...shell} type="newsletter" design={{ ...c.design, align: "center" }}>
      <div className="mx-auto max-w-md">
        <SectionHeading title={c.heading} subtitle={c.body} align="center" className="mb-5" />
        {form}
      </div>
    </SectionShell>
  );
}

export function CustomBanner({ c, ctx }: { c: SectionConfig<"customBanner">; ctx: Ctx }) {
  const { s, shell } = ctx;
  const cta = c.ctaLabel && <StoreLink href={c.ctaHref || "/shop"} storeSlug={s} className={cn("st-btn st-btn-sm", c.layout === "poster" && "st-btn-inverse")}>{c.ctaLabel}</StoreLink>;
  if (c.layout === "poster") {
    return (
      <SectionShell {...shell} type="customBanner" design={{ ...c.design, scheme: "contrast", paddingTop: "none", paddingBottom: "none" }} bleed className="relative min-h-[360px] overflow-hidden">
        <Media media={{ ...c.media, overlay: Math.max(c.media.overlay, 40) }} fill />
        <div className="st-section-inner relative flex min-h-[360px] flex-col items-start justify-center py-12 text-white" style={{ maxWidth: "var(--st-max-width)" }}>
          <h2 className="st-heading-transform st-h-lg max-w-2xl">{c.heading}</h2>
          {c.body && <p className="st-lead mt-3 max-w-lg" style={{ color: "rgba(255,255,255,0.85)" }}>{c.body}</p>}
          {cta && <div className="mt-6">{cta}</div>}
        </div>
      </SectionShell>
    );
  }
  if (c.layout === "card") {
    return (
      <SectionShell {...shell} type="customBanner" design={c.design}>
        <div className="st-radius-card st-shadow grid overflow-hidden border md:grid-cols-[2fr_3fr]" style={{ background: "var(--st-surface)", borderColor: "var(--st-border)" }}>
          {hasMedia(c.media) && <Media media={c.media} ratio="landscape" className="!rounded-none md:h-full" />}
          <div className={cn("flex flex-col justify-center p-8 sm:p-10", !hasMedia(c.media) && "md:col-span-2")}>
            <h2 className="st-heading-transform st-h-md">{c.heading}</h2>
            {c.body && <p className="st-muted mt-3 text-[15px]">{c.body}</p>}
            {cta && <div className="mt-6">{cta}</div>}
          </div>
        </div>
      </SectionShell>
    );
  }
  return (
    <SectionShell {...shell} type="customBanner" design={c.design}>
      <div className="st-radius flex flex-wrap items-center justify-between gap-4 border px-7 py-7" style={{ borderColor: "var(--st-border-strong)" }}>
        <div>
          <h2 className="st-heading-transform st-h-sm">{c.heading}</h2>
          {c.body && <p className="st-muted mt-1.5 text-[14.5px]">{c.body}</p>}
        </div>
        {cta}
      </div>
    </SectionShell>
  );
}

export function ValueProps({ c, ctx }: { c: SectionConfig<"valueProps">; ctx: Ctx }) {
  const { shell } = ctx;
  const items = c.items ?? [];
  if (!items.length) return null;
  return (
    <SectionShell {...shell} type="valueProps" design={{ ...c.design, paddingTop: c.design.paddingTop === "md" ? "sm" : c.design.paddingTop, paddingBottom: c.design.paddingBottom === "md" ? "sm" : c.design.paddingBottom }}>
      <Stagger as="ul" className={cn(c.layout === "grid" ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-wrap justify-between gap-x-10 gap-y-6")}>
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-3" style={staggerIndex(i)}>
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--st-surface-alt)", color: "var(--st-accent)" }}><Icon name={it.icon} className="size-4" /></span>
            <div><p className="text-[14px] font-semibold">{it.title}</p>{it.body && <p className="st-muted text-[12.5px]">{it.body}</p>}</div>
          </li>
        ))}
      </Stagger>
    </SectionShell>
  );
}
