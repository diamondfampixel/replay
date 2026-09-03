import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SectionDesign } from "@/lib/storefront/sections";
import type { ResolvedTheme } from "@/lib/storefront/theme";

const PAD_MULT: Record<SectionDesign["paddingTop"], number> = { none: 0, sm: 0.55, md: 1, lg: 1.45, xl: 1.95 };

export type ShellProps = {
  design: SectionDesign;
  theme: Pick<ResolvedTheme, "schemes" | "motionConfig">;
  /** Editor bridge metadata — present in preview so the iframe can select sections. */
  id?: string;
  type: string;
  label?: string;
  index?: number;
  preview?: boolean;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
  /** Full-bleed sections manage their own inner layout. */
  bleed?: boolean;
  children: ReactNode;
};

/**
 * The one wrapper every section renders through. It turns the shared
 * `design` object into data attributes + a couple of inline custom
 * properties, and the CSS in globals.css does the rest: colour scheme, width,
 * spacing, alignment, borders, per-section motion and scroll reveal.
 */
export function SectionShell({
  design, theme, id, type, label, index, preview, className, innerClassName, style, bleed, children,
}: ShellProps) {
  const custom = design.scheme === "custom" ? theme.schemes.find((s) => s.id === design.customScheme) : undefined;
  const scheme = design.scheme === "custom" && !custom ? "base" : design.scheme;
  const reveal = design.reveal === "inherit" ? theme.motionConfig.reveal : design.reveal;
  const motion = design.motion === "inherit" ? undefined : design.motion;

  const vars: Record<string, string> = {};
  if (custom) {
    vars["--st-section-bg"] = custom.background;
    vars["--st-section-fg"] = custom.foreground;
    vars["--st-section-accent"] = custom.accent;
  }

  return (
    <section
      id={id ? `s-${id}` : undefined}
      data-section-id={id}
      data-section-type={type}
      data-section-index={index}
      data-scheme={scheme}
      data-width={bleed ? "full" : design.width}
      data-align={design.align}
      data-mobile-align={design.mobileAlign === "inherit" ? undefined : design.mobileAlign}
      data-mobile-hide={design.mobileHide ? "true" : undefined}
      data-border={design.border === "none" ? undefined : design.border}
      data-motion={motion}
      data-reveal={reveal === "none" ? undefined : reveal}
      className={cn("st-section", className)}
      style={{
        ...vars,
        paddingTop: `calc(var(--st-section-gap) * ${PAD_MULT[design.paddingTop]})`,
        paddingBottom: `calc(var(--st-section-gap) * ${PAD_MULT[design.paddingBottom]})`,
        ...style,
      } as CSSProperties}
    >
      {preview && label && <span className="st-section-tag" aria-hidden="true">{label}</span>}
      {bleed ? children : <div className={cn("st-section-inner", innerClassName)}>{children}</div>}
    </section>
  );
}

/** Wraps a list so its children enter one after another (see .st-stagger). */
export function Stagger({ children, className, as: Tag = "div", style }: { children: ReactNode; className?: string; as?: "div" | "ul"; style?: CSSProperties }) {
  return <Tag className={cn("st-stagger", className)} style={style}>{children}</Tag>;
}

export function staggerIndex(i: number): CSSProperties {
  return { "--st-i": i } as CSSProperties;
}
