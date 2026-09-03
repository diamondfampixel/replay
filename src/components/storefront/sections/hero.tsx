import { cn } from "@/lib/utils";
import type { SectionConfig } from "@/lib/storefront/sections";
import { SectionShell, type ShellProps } from "@/components/storefront/section-shell";
import { Media, hasMedia } from "@/components/storefront/media";
import { Parallax, VideoBackground } from "@/components/storefront/motion";
import { Eyebrow, StoreLink } from "@/components/storefront/primitives";
import type { ResolvedTheme } from "@/lib/storefront/theme";

type Shell = Omit<ShellProps, "design" | "children" | "type">;
type Ctx = { s: string; theme: ResolvedTheme; shell: Shell };

const HEIGHT: Record<string, string> = { auto: "", small: "min-h-[40vh]", medium: "min-h-[56vh]", large: "min-h-[72vh]", screen: "min-h-[calc(100svh-4rem)]" };
const PAD: Record<string, string> = { auto: "py-16", small: "py-16 sm:py-20", medium: "py-24 sm:py-32", large: "py-28 sm:py-40", screen: "py-32 sm:py-48" };
const HEADING: Record<string, string> = { md: "st-h-md", lg: "st-h-lg", xl: "st-h-xl", display: "st-h-display" };

function Ctas({ c, s, inverse, size = "md" }: { c: { ctaLabel: string; ctaHref: string; secondaryCtaLabel?: string; secondaryCtaHref?: string }; s: string; inverse?: boolean; size?: "md" | "lg" }) {
  if (!c.ctaLabel && !c.secondaryCtaLabel) return null;
  return (
    <div className="st-jc mt-8 flex flex-wrap gap-3">
      {c.ctaLabel && (
        <StoreLink href={c.ctaHref || "/shop"} storeSlug={s} className={cn("st-btn", size === "lg" && "st-btn-lg", inverse && "st-btn-inverse")}>
          {c.ctaLabel}
        </StoreLink>
      )}
      {c.secondaryCtaLabel && (
        <StoreLink href={c.secondaryCtaHref || "/pages/about"} storeSlug={s} className={cn("st-btn st-btn-secondary", size === "lg" && "st-btn-lg")} style={inverse ? { color: "#fff", borderColor: "rgba(255,255,255,0.6)" } : undefined}>
          {c.secondaryCtaLabel}
        </StoreLink>
      )}
    </div>
  );
}

export function Hero({ c, ctx }: { c: SectionConfig<"hero">; ctx: Ctx }) {
  const { s, theme, shell } = ctx;
  const heading = HEADING[c.headingSize] ?? "st-h-xl";
  const media = hasMedia(c.media) ? c.media : null;
  const parallax = theme.motionConfig.parallax;

  if (c.layout === "fullBleed" || (c.layout === "left" && media) || (c.layout === "center" && media)) {
    const design = { ...c.design, scheme: media ? "contrast" as const : c.design.scheme };
    const centred = c.layout === "center" || (c.layout === "fullBleed" && c.align === "center");
    return (
      <SectionShell {...shell} type="hero" design={{ ...design, paddingTop: "none", paddingBottom: "none" }} bleed className={cn("relative overflow-hidden", HEIGHT[c.height])}>
        {media && (parallax ? <Parallax className="absolute inset-0"><Media media={{ ...media, overlay: 0 }} fill lazy={false} /></Parallax> : <Media media={{ ...media, overlay: 0 }} fill lazy={false} />)}
        {media && (
          <div className="absolute inset-0" aria-hidden="true" style={{ background: centred
            ? `linear-gradient(to top, rgba(8,8,8,${0.35 + (media.overlay || 30) / 200}), rgba(8,8,8,${(media.overlay || 30) / 300}))`
            : `linear-gradient(to right, rgba(8,8,8,${0.4 + (media.overlay || 30) / 200}), rgba(8,8,8,${(media.overlay || 30) / 400}) 60%, transparent)` }} />
        )}
        <div className={cn("st-bleed-inner relative flex flex-col justify-center", PAD[c.height], HEIGHT[c.height], centred && "items-center text-center")} style={{ maxWidth: "var(--st-max-width)", color: media ? "#fff" : undefined }}>
          <Eyebrow className={media ? "text-white/80" : undefined}>{c.eyebrow}</Eyebrow>
          <h1 className={cn("st-heading-transform max-w-4xl", heading)}>{c.headline}</h1>
          {c.subheadline && <p className={cn("st-lead mt-5 max-w-xl", !media && "st-muted")} style={media ? { color: "rgba(255,255,255,0.88)" } : undefined}>{c.subheadline}</p>}
          <Ctas c={c} s={s} inverse={Boolean(media)} size={c.headingSize === "display" ? "lg" : "md"} />
        </div>
      </SectionShell>
    );
  }

  if (c.layout === "split") {
    return (
      <SectionShell {...shell} type="hero" design={c.design}>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h1 className={cn("st-heading-transform", heading)}>{c.headline}</h1>
            {c.subheadline && <p className="st-muted st-lead mt-5 max-w-lg">{c.subheadline}</p>}
            <Ctas c={c} s={s} />
          </div>
          <Media media={c.media} ratio="portrait" className="st-zoom w-full lg:justify-self-end" lazy={false} />
        </div>
      </SectionShell>
    );
  }

  if (c.layout === "editorial") {
    return (
      <SectionShell {...shell} type="hero" design={c.design}>
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h1 className={cn("st-heading-transform", HEADING[c.headingSize === "md" ? "lg" : c.headingSize] ?? "st-h-xl")}>{c.headline}</h1>
          </div>
          <div className="lg:col-span-4 lg:pb-2">
            {c.subheadline && <p className="st-muted st-lead max-w-sm">{c.subheadline}</p>}
            <Ctas c={c} s={s} />
          </div>
        </div>
        {media && <Media media={media} ratio="wide" className="st-zoom mt-12" lazy={false} />}
      </SectionShell>
    );
  }

  if (c.layout === "minimal") {
    return (
      <SectionShell {...shell} type="hero" design={c.design} className={PAD[c.height]}>
        <div className="max-w-4xl">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className={cn("st-heading-transform", heading)}>{c.headline}</h1>
          {c.subheadline && <p className="st-muted st-lead mt-6 max-w-md">{c.subheadline}</p>}
          {c.ctaLabel && (
            <StoreLink href={c.ctaHref || "/shop"} storeSlug={s} className="st-btn st-btn-underline mt-8 text-[15px]">
              {c.ctaLabel} →
            </StoreLink>
          )}
        </div>
      </SectionShell>
    );
  }

  if (c.layout === "asymmetric") {
    return (
      <SectionShell {...shell} type="hero" design={c.design}>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="relative z-10 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:pt-10">
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h1 className={cn("st-heading-transform", HEADING[c.headingSize === "md" ? "xl" : c.headingSize === "lg" ? "xl" : c.headingSize] ?? "st-h-display")} style={{ maxWidth: "12ch" }}>{c.headline}</h1>
          </div>
          <div className="lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:-mt-6">
            <Media media={c.media} ratio="landscape" className="st-zoom" lazy={false} />
          </div>
          <div className="lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:-mt-12">
            {c.subheadline && <p className="st-muted st-lead max-w-md">{c.subheadline}</p>}
            <Ctas c={c} s={s} />
          </div>
        </div>
      </SectionShell>
    );
  }

  // left / center without media
  const centred = c.layout === "center" || c.align === "center";
  return (
    <SectionShell {...shell} type="hero" design={{ ...c.design, align: centred ? "center" : c.design.align }} className={PAD[c.height]}>
      <div className={cn("max-w-3xl", centred && "mx-auto")}>
        <Eyebrow>{c.eyebrow}</Eyebrow>
        <h1 className={cn("st-heading-transform", heading)}>{c.headline}</h1>
        {c.subheadline && <p className={cn("st-muted st-lead mt-5 max-w-xl", centred && "mx-auto")}>{c.subheadline}</p>}
        <Ctas c={c} s={s} size={c.headingSize === "display" ? "lg" : "md"} />
      </div>
    </SectionShell>
  );
}

export function ImageHero({ c, ctx }: { c: SectionConfig<"imageHero">; ctx: Ctx }) {
  const { s, theme, shell } = ctx;
  const media = { ...c.media, overlay: 0 };
  const overlay = (Number(c.overlay) || 30) / 100;
  const parallax = c.parallax && theme.motionConfig.parallax;
  const image = parallax ? <Parallax className="absolute inset-0"><Media media={media} fill lazy={false} /></Parallax> : <Media media={media} fill lazy={false} />;

  if (c.layout === "editorial") {
    return (
      <SectionShell {...shell} type="imageHero" design={c.design} bleed className="overflow-hidden">
        <div className={cn("relative", HEIGHT[c.height] || "min-h-[56vh]")}>{image}</div>
        <div className="st-bleed-inner grid gap-6 py-8 md:grid-cols-[1fr_auto] md:items-end" style={{ maxWidth: "var(--st-max-width)" }}>
          <div>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h2 className="st-heading-transform st-h-lg">{c.headline}</h2>
            {c.subheadline && <p className="st-muted st-lead mt-3 max-w-xl">{c.subheadline}</p>}
          </div>
          {c.ctaLabel && <StoreLink href={c.ctaHref || "/shop"} storeSlug={s} className="st-btn">{c.ctaLabel}</StoreLink>}
        </div>
      </SectionShell>
    );
  }

  const bottomLeft = c.layout === "bottomLeft";
  const centred = c.layout === "centered" || (c.layout === "overlay" && c.align === "center");
  return (
    <SectionShell {...shell} type="imageHero" design={{ ...c.design, scheme: "contrast", paddingTop: "none", paddingBottom: "none" }} bleed className={cn("relative overflow-hidden", HEIGHT[c.height] || "min-h-[56vh]")}>
      {image}
      <div className="absolute inset-0" style={{ background: bottomLeft ? `linear-gradient(to top, rgba(0,0,0,${overlay + 0.3}), rgba(0,0,0,${overlay / 3}) 60%)` : `rgba(0,0,0,${overlay})` }} aria-hidden="true" />
      <div className={cn("st-bleed-inner relative flex flex-col text-white", PAD[c.height], HEIGHT[c.height] || "min-h-[56vh]", bottomLeft ? "justify-end" : "justify-center", centred && "items-center text-center")} style={{ maxWidth: "var(--st-max-width)" }}>
        <Eyebrow className="text-white/80">{c.eyebrow}</Eyebrow>
        <h2 className={cn("st-heading-transform max-w-3xl", bottomLeft ? "st-h-xl" : "st-h-xl")}>{c.headline}</h2>
        {c.subheadline && <p className="st-lead mt-4 max-w-lg" style={{ color: "rgba(255,255,255,0.88)" }}>{c.subheadline}</p>}
        {c.ctaLabel && (
          <StoreLink href={c.ctaHref || "/shop"} storeSlug={s} className="st-btn st-btn-inverse mt-7 w-fit">{c.ctaLabel}</StoreLink>
        )}
      </div>
    </SectionShell>
  );
}

export function VideoHero({ c, ctx }: { c: SectionConfig<"videoHero">; ctx: Ctx }) {
  const { s, shell } = ctx;
  const overlay = (Number(c.overlay) || 35) / 100;
  const centred = c.align === "center";
  return (
    <SectionShell {...shell} type="videoHero" design={{ ...c.design, scheme: "contrast", paddingTop: "none", paddingBottom: "none" }} bleed className={cn("relative overflow-hidden", HEIGHT[c.height] || "min-h-[72vh]")}>
      {c.posterUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={c.posterUrl} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      {c.videoUrl && <VideoBackground src={c.videoUrl} poster={c.posterUrl} />}
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} aria-hidden="true" />
      <div className={cn("st-bleed-inner relative flex flex-col justify-center text-white", PAD[c.height], HEIGHT[c.height] || "min-h-[72vh]", centred && "items-center text-center")} style={{ maxWidth: "var(--st-max-width)" }}>
        <Eyebrow className="text-white/80">{c.eyebrow}</Eyebrow>
        <h2 className="st-heading-transform st-h-xl max-w-3xl">{c.headline}</h2>
        {c.subheadline && <p className="st-lead mt-4 max-w-lg" style={{ color: "rgba(255,255,255,0.88)" }}>{c.subheadline}</p>}
        {c.ctaLabel && <StoreLink href={c.ctaHref || "/shop"} storeSlug={s} className="st-btn st-btn-inverse mt-7 w-fit">{c.ctaLabel}</StoreLink>}
      </div>
    </SectionShell>
  );
}

export function Announcement({ c, ctx }: { c: SectionConfig<"announcement">; ctx: Ctx }) {
  const { s, shell } = ctx;
  const scheme = c.background === "brand" ? "accent" : c.background === "muted" ? "muted" : "contrast";
  const body = c.link ? <StoreLink href={c.link} storeSlug={s} className="hover:underline">{c.text}</StoreLink> : <span>{c.text}</span>;
  return (
    <SectionShell {...shell} type="announcement" design={{ ...c.design, scheme, paddingTop: "none", paddingBottom: "none", reveal: "none" }} bleed className="px-5 py-2 text-center text-[12.5px]">
      {c.layout === "marquee" ? (
        <div className="st-marquee -mx-5" aria-label={c.text}>
          <div className="st-marquee-track">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} aria-hidden={i > 0}>{body}</span>
            ))}
          </div>
        </div>
      ) : body}
    </SectionShell>
  );
}

const MARQUEE_SIZE: Record<string, string> = { sm: "text-[0.95rem]", md: "st-h-sm", lg: "st-h-md", xl: "st-h-lg" };
export function Marquee({ c, ctx }: { c: SectionConfig<"marquee">; ctx: Ctx }) {
  const items = c.items.filter((i) => i.text.trim());
  if (!items.length) return null;
  const copies = Math.max(2, Math.ceil(24 / items.length));
  return (
    <SectionShell {...ctx.shell} type="marquee" design={{ ...c.design, paddingTop: c.design.paddingTop === "md" ? "sm" : c.design.paddingTop, paddingBottom: c.design.paddingBottom === "md" ? "sm" : c.design.paddingBottom, reveal: "none" }} bleed>
      <div className="st-marquee" data-direction={c.direction} aria-label={items.map((i) => i.text).join(", ")}>
        <div className={cn("st-marquee-track st-display st-heading-transform", MARQUEE_SIZE[c.size])} style={{ fontWeight: "var(--st-heading-weight)" as React.CSSProperties["fontWeight"] }}>
          {Array.from({ length: copies }).flatMap((_, copy) =>
            items.map((item, i) => (
              <span key={`${copy}-${i}`} aria-hidden={copy > 0} className="inline-flex items-center gap-10">
                {item.text}
                <span className="opacity-40">{c.separator}</span>
              </span>
            )),
          )}
        </div>
      </div>
    </SectionShell>
  );
}
