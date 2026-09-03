import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { SectionMedia } from "@/lib/storefront/sections";

const RATIO: Record<string, string> = { square: "1 / 1", portrait: "4 / 5", landscape: "4 / 3", tall: "3 / 4", wide: "16 / 9" };

/**
 * Renders a section image with focal point, overlay, alt text and an optional
 * mobile crop. Missing media renders a quiet surface so an unfinished section
 * still holds its layout instead of showing a broken image.
 */
export function Media({
  media, ratio = "inherit", className, style, fill, lazy = true, sizes,
}: {
  media: SectionMedia | null | undefined;
  ratio?: string;
  className?: string;
  style?: CSSProperties;
  /** Cover the parent (absolute) instead of taking its own aspect ratio. */
  fill?: boolean;
  lazy?: boolean;
  sizes?: string;
}) {
  const url = media?.url || null;
  const position = `${media?.focalX ?? 50}% ${media?.focalY ?? 50}%`;
  const aspect = ratio === "inherit" ? "var(--st-image-ratio, 1 / 1)" : RATIO[ratio] ?? "var(--st-image-ratio, 1 / 1)";
  const overlay = media?.overlay ?? 0;

  return (
    <div
      data-fill={fill ? "true" : undefined}
      className={cn("st-media", fill ? "absolute inset-0" : "st-radius-image", className)}
      style={fill ? style : { aspectRatio: aspect, ...style }}
    >
      {url ? (
        media?.mobileUrl ? (
          <picture>
            <source media="(max-width: 640px)" srcSet={media.mobileUrl} />
            <img src={url} alt={media?.alt ?? ""} loading={lazy ? "lazy" : "eager"} decoding="async" style={{ objectPosition: position }} sizes={sizes} />
          </picture>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt={media?.alt ?? ""} loading={lazy ? "lazy" : "eager"} decoding="async" style={{ objectPosition: position }} sizes={sizes} />
        )
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, var(--st-surface-alt), color-mix(in srgb, var(--st-accent) 18%, var(--st-surface-alt)))" }} aria-hidden="true" />
      )}
      {overlay > 0 && <div className="st-media-overlay" style={{ opacity: overlay / 100 }} aria-hidden="true" />}
    </div>
  );
}

export function hasMedia(media: SectionMedia | null | undefined): boolean {
  return Boolean(media?.url);
}
