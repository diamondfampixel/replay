import { z } from "zod";

/**
 * Storefront design system.
 *
 * A store's *content* is its sections (see sections.ts). Its *look* is a
 * StoreTheme: a small set of structured, safe design tokens — typography,
 * shape, density, colour roles, product-card and hero treatment, motion.
 *
 * The renderer and primitives read these as CSS custom properties (`--st-*`)
 * set on the storefront root, so nothing hard-codes a radius or a font. Two
 * stores on different directions look genuinely different; the AI (and the
 * visual editor) only ever choose from these discrete options, never raw CSS.
 */

// ---------------------------------------------------------------------------
// Fonts — a curated pairing pool of open-licence Google Fonts. The AI and the
// editor pick a key; the layout loads only the families a store actually uses.
// ---------------------------------------------------------------------------

export type FontRole = "display" | "body";

type FontDef = {
  /** Google Fonts family name, exactly as the API expects it. */
  family: string;
  /** Weights to request. */
  weights: number[];
  /** CSS fallback stack appended after the family. */
  stack: string;
};

export const FONTS = {
  inter: { family: "Inter", weights: [400, 500, 600, 700], stack: "system-ui, sans-serif" },
  geist: { family: "Geist", weights: [400, 500, 600, 700], stack: "system-ui, sans-serif" },
  schibsted: { family: "Schibsted Grotesk", weights: [500, 600, 700], stack: "system-ui, sans-serif" },
  spaceGrotesk: { family: "Space Grotesk", weights: [400, 500, 600, 700], stack: "system-ui, sans-serif" },
  archivo: { family: "Archivo", weights: [500, 600, 700, 800], stack: "system-ui, sans-serif" },
  anton: { family: "Anton", weights: [400], stack: "Impact, system-ui, sans-serif" },
  fraunces: { family: "Fraunces", weights: [400, 500, 600, 700], stack: "Georgia, serif" },
  playfair: { family: "Playfair Display", weights: [500, 600, 700], stack: "Georgia, serif" },
  cormorant: { family: "Cormorant Garamond", weights: [500, 600, 700], stack: "Georgia, serif" },
  dmSerif: { family: "DM Serif Display", weights: [400], stack: "Georgia, serif" },
  poppins: { family: "Poppins", weights: [400, 500, 600, 700], stack: "system-ui, sans-serif" },
  fredoka: { family: "Fredoka", weights: [400, 500, 600, 700], stack: "system-ui, sans-serif" },
  jost: { family: "Jost", weights: [400, 500, 600], stack: "system-ui, sans-serif" },
  dmSans: { family: "DM Sans", weights: [400, 500, 700], stack: "system-ui, sans-serif" },
  nunito: { family: "Nunito Sans", weights: [400, 600, 700], stack: "system-ui, sans-serif" },
  plexSans: { family: "IBM Plex Sans", weights: [400, 500, 600], stack: "system-ui, sans-serif" },
  libreFranklin: { family: "Libre Franklin", weights: [400, 500, 600, 700], stack: "system-ui, sans-serif" },
} satisfies Record<string, FontDef>;

export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as [FontKey, ...FontKey[]];

// ---------------------------------------------------------------------------
// Token enums
// ---------------------------------------------------------------------------

export const RADII = ["none", "xs", "sm", "md", "lg", "xl", "pill"] as const;
export const BUTTON_STYLES = ["solid", "outline", "soft"] as const;
export const BUTTON_SHAPES = ["sharp", "rounded", "pill"] as const;
export const DENSITIES = ["compact", "comfortable", "spacious"] as const;
export const CARD_STYLES = ["minimal", "framed", "editorial", "elevated"] as const;
export const IMAGE_RATIOS = ["square", "portrait", "landscape", "tall"] as const;
export const HEADING_TRANSFORMS = ["none", "uppercase"] as const;
export const NEUTRAL_TEMPS = ["warm", "cool", "pure", "sand", "slate"] as const;
export const MOTION_LEVELS = ["none", "subtle", "expressive"] as const;
export const HEADER_STYLES = ["classic", "centered", "minimal"] as const;

export const DESIGN_DIRECTIONS = [
  "modern",
  "editorial",
  "minimal",
  "bold",
  "luxury",
  "playful",
  "technical",
  "organic",
] as const;
export type DesignDirection = (typeof DESIGN_DIRECTIONS)[number];

// ---------------------------------------------------------------------------
// Theme schema — what is stored per store. Every field is optional and merges
// over the chosen direction's preset, so a store can start from a direction and
// nudge individual tokens without redefining the whole system.
// ---------------------------------------------------------------------------

export const storeThemeSchema = z.object({
  direction: z.enum(DESIGN_DIRECTIONS).default("modern"),
  fontDisplay: z.enum(FONT_KEYS).optional(),
  fontBody: z.enum(FONT_KEYS).optional(),
  radius: z.enum(RADII).optional(),
  buttonStyle: z.enum(BUTTON_STYLES).optional(),
  buttonShape: z.enum(BUTTON_SHAPES).optional(),
  density: z.enum(DENSITIES).optional(),
  cardStyle: z.enum(CARD_STYLES).optional(),
  imageRatio: z.enum(IMAGE_RATIOS).optional(),
  headingTransform: z.enum(HEADING_TRANSFORMS).optional(),
  headingWeight: z.number().int().min(400).max(900).optional(),
  neutral: z.enum(NEUTRAL_TEMPS).optional(),
  motion: z.enum(MOTION_LEVELS).optional(),
  header: z.enum(HEADER_STYLES).optional(),
  /** Accent colour override. Falls back to the store's primaryColor. */
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type StoreTheme = z.infer<typeof storeThemeSchema>;

/** A direction preset: the coordinated defaults a direction stands for. */
type DirectionPreset = Required<Omit<StoreTheme, "direction" | "accent">> & {
  label: string;
  blurb: string;
};

// Each direction moves *many* tokens together, so the results feel like
// different studios designed them — not one template recoloured.
export const DIRECTION_PRESETS: Record<DesignDirection, DirectionPreset> = {
  modern: {
    label: "Modern",
    blurb: "Clean grotesk type, soft corners, confident and neutral. A safe, contemporary default.",
    fontDisplay: "schibsted", fontBody: "inter", radius: "md", buttonStyle: "solid", buttonShape: "rounded",
    density: "comfortable", cardStyle: "minimal", imageRatio: "square", headingTransform: "none",
    headingWeight: 600, neutral: "cool", motion: "subtle", header: "classic",
  },
  editorial: {
    label: "Editorial",
    blurb: "Serif display over generous whitespace. Reads like a considered magazine.",
    fontDisplay: "fraunces", fontBody: "inter", radius: "none", buttonStyle: "outline", buttonShape: "sharp",
    density: "spacious", cardStyle: "editorial", imageRatio: "portrait", headingTransform: "none",
    headingWeight: 500, neutral: "warm", motion: "subtle", header: "centered",
  },
  minimal: {
    label: "Minimal",
    blurb: "Maximum restraint. Tight type, hairline detail, product-first.",
    fontDisplay: "inter", fontBody: "inter", radius: "none", buttonStyle: "solid", buttonShape: "sharp",
    density: "spacious", cardStyle: "minimal", imageRatio: "portrait", headingTransform: "none",
    headingWeight: 600, neutral: "pure", motion: "subtle", header: "minimal",
  },
  bold: {
    label: "Bold",
    blurb: "Heavy condensed headlines, high contrast, energetic. Made to grab a scroller.",
    fontDisplay: "archivo", fontBody: "libreFranklin", radius: "sm", buttonStyle: "solid", buttonShape: "sharp",
    density: "comfortable", cardStyle: "framed", imageRatio: "square", headingTransform: "uppercase",
    headingWeight: 800, neutral: "slate", motion: "expressive", header: "classic",
  },
  luxury: {
    label: "Luxury",
    blurb: "High-contrast serif, wide letter-spacing, deep neutrals. Quiet, expensive restraint.",
    fontDisplay: "cormorant", fontBody: "jost", radius: "none", buttonStyle: "outline", buttonShape: "sharp",
    density: "spacious", cardStyle: "editorial", imageRatio: "tall", headingTransform: "uppercase",
    headingWeight: 600, neutral: "warm", motion: "subtle", header: "centered",
  },
  playful: {
    label: "Playful",
    blurb: "Round friendly type, pill shapes, bright and bouncy. Great for fun consumer brands.",
    fontDisplay: "fredoka", fontBody: "nunito", radius: "xl", buttonStyle: "solid", buttonShape: "pill",
    density: "comfortable", cardStyle: "elevated", imageRatio: "square", headingTransform: "none",
    headingWeight: 600, neutral: "pure", motion: "expressive", header: "classic",
  },
  technical: {
    label: "Technical",
    blurb: "Grotesk + mono accents, tight grid, precise. For tools, gear and hardware.",
    fontDisplay: "spaceGrotesk", fontBody: "plexSans", radius: "sm", buttonStyle: "solid", buttonShape: "rounded",
    density: "compact", cardStyle: "framed", imageRatio: "landscape", headingTransform: "none",
    headingWeight: 600, neutral: "slate", motion: "subtle", header: "minimal",
  },
  organic: {
    label: "Organic",
    blurb: "Warm serif display, soft sand neutrals, unhurried. Skincare, wellness, food.",
    fontDisplay: "dmSerif", fontBody: "nunito", radius: "lg", buttonStyle: "soft", buttonShape: "pill",
    density: "spacious", cardStyle: "minimal", imageRatio: "portrait", headingTransform: "none",
    headingWeight: 500, neutral: "sand", motion: "subtle", header: "centered",
  },
};

// ---------------------------------------------------------------------------
// Colour derivation — from a single accent + a neutral temperature we derive a
// full, contrast-checked set of surface/ink/border tokens. No dependency; a
// small sRGB helper is enough for the handful of shades we need. (culori /
// material-color-utilities are the recommended upgrade if we later want tonal
// palettes; this stays dependency-free for the launch pass.)
// ---------------------------------------------------------------------------

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16) };
}
function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}
function relLuminance({ r, g, b }: Rgb): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(hexToRgb(a));
  const lb = relLuminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
/** Readable foreground (near-black or near-white) for a given background. */
function readableInk(bg: string, dark = "#141414", light = "#ffffff"): string {
  return contrastRatio(bg, dark) >= contrastRatio(bg, light) ? dark : light;
}

/**
 * A solid button that always clears WCAG AA. A coloured button reads best with
 * white text, so we keep white and darken the accent just enough to hit 4.5:1
 * when the raw accent is a bright mid-tone; a genuinely dark accent keeps its
 * colour and takes white text unchanged; a very light accent takes dark text.
 */
function solidButton(accent: string): { bg: string; fg: string } {
  if (contrastRatio(accent, "#ffffff") >= 4.5) return { bg: accent, fg: "#ffffff" };
  if (contrastRatio(accent, "#141414") >= 4.5) return { bg: accent, fg: "#141414" };
  let rgb = hexToRgb(accent);
  for (let i = 0; i < 16 && contrastRatio(rgbToHex(rgb), "#ffffff") < 4.5; i++) {
    rgb = mix(rgb, { r: 0, g: 0, b: 0 }, 0.08);
  }
  return { bg: rgbToHex(rgb), fg: "#ffffff" };
}

const NEUTRAL_BASE: Record<(typeof NEUTRAL_TEMPS)[number], { bg: Rgb; ink: Rgb }> = {
  warm: { bg: hexToRgb("#faf8f4"), ink: hexToRgb("#241f1a") },
  cool: { bg: hexToRgb("#fbfbfc"), ink: hexToRgb("#16181d") },
  pure: { bg: hexToRgb("#ffffff"), ink: hexToRgb("#111111") },
  sand: { bg: hexToRgb("#f7f2ea"), ink: hexToRgb("#2a231b") },
  slate: { bg: hexToRgb("#f7f8fa"), ink: hexToRgb("#12151b") },
};

// ---------------------------------------------------------------------------
// Resolution — direction preset merged with per-store overrides, then flattened
// into concrete CSS values.
// ---------------------------------------------------------------------------

export type ResolvedTheme = {
  direction: DesignDirection;
  fontDisplay: FontKey;
  fontBody: FontKey;
  vars: Record<string, string>;
  /** Google Fonts families to load for this store (deduped). */
  fontFamilies: FontDef[];
  motion: (typeof MOTION_LEVELS)[number];
  cardStyle: (typeof CARD_STYLES)[number];
  header: (typeof HEADER_STYLES)[number];
};

const RADIUS_PX: Record<(typeof RADII)[number], string> = {
  none: "0px", xs: "3px", sm: "6px", md: "10px", lg: "16px", xl: "24px", pill: "9999px",
};
const DENSITY_GAP: Record<(typeof DENSITIES)[number], { section: string; sectionSm: string }> = {
  compact: { section: "40px", sectionSm: "56px" },
  comfortable: { section: "56px", sectionSm: "80px" },
  spacious: { section: "72px", sectionSm: "112px" },
};
const RATIO_CSS: Record<(typeof IMAGE_RATIOS)[number], string> = {
  square: "1 / 1", portrait: "4 / 5", landscape: "4 / 3", tall: "3 / 4",
};

export function resolveTheme(input: {
  theme?: unknown;
  primaryColor: string;
  secondaryColor?: string;
}): ResolvedTheme {
  const parsed = storeThemeSchema.safeParse(input.theme ?? {});
  const theme: StoreTheme = parsed.success ? parsed.data : storeThemeSchema.parse({});
  const preset = DIRECTION_PRESETS[theme.direction];

  const fontDisplay = theme.fontDisplay ?? preset.fontDisplay;
  const fontBody = theme.fontBody ?? preset.fontBody;
  const radius = theme.radius ?? preset.radius;
  const buttonStyle = theme.buttonStyle ?? preset.buttonStyle;
  const buttonShape = theme.buttonShape ?? preset.buttonShape;
  const density = theme.density ?? preset.density;
  const cardStyle = theme.cardStyle ?? preset.cardStyle;
  const imageRatio = theme.imageRatio ?? preset.imageRatio;
  const headingTransform = theme.headingTransform ?? preset.headingTransform;
  const headingWeight = theme.headingWeight ?? preset.headingWeight;
  const neutral = theme.neutral ?? preset.neutral;
  const motion = theme.motion ?? preset.motion;
  const header = theme.header ?? preset.header;
  const accent = theme.accent ?? input.primaryColor;

  const base = NEUTRAL_BASE[neutral];
  const bg = rgbToHex(base.bg);
  const ink = rgbToHex(base.ink);
  const surface = rgbToHex(mix(base.bg, { r: 255, g: 255, b: 255 }, base.bg.r < 250 ? 0.4 : 0)); // lighter card on tinted grounds
  const surfaceAlt = rgbToHex(mix(base.bg, base.ink, 0.05));
  const border = rgbToHex(mix(base.bg, base.ink, 0.14));
  const borderStrong = rgbToHex(mix(base.bg, base.ink, 0.24));
  // Muted text must clear WCAG AA on BOTH grounds it can sit on: the page bg
  // and the slightly darker surface-alt (muted sections, footer). Tuning
  // against the darker of the two guarantees it on both.
  const mutedGround = surfaceAlt;
  let mutedMix = 0.62;
  let mutedInk = rgbToHex(mix(base.bg, base.ink, mutedMix));
  while (mutedMix < 0.85 && contrastRatio(mutedInk, mutedGround) < 4.5) {
    mutedMix += 0.03;
    mutedInk = rgbToHex(mix(base.bg, base.ink, mutedMix));
  }
  const accentInk = readableInk(accent);
  const contrastPanel = rgbToHex(mix(base.ink, { r: 0, g: 0, b: 0 }, 0.15));

  // Button roles depend on style token; solid always clears AA.
  const solid = solidButton(accent);
  let btnBg = solid.bg, btnFg = solid.fg, btnBorder = solid.bg;
  if (buttonStyle === "outline") { btnBg = "transparent"; btnFg = ink; btnBorder = borderStrong; }
  if (buttonStyle === "soft") { btnBg = rgbToHex(mix(hexToRgb(accent), base.bg, 0.82)); btnFg = readableInk(rgbToHex(mix(hexToRgb(accent), base.bg, 0.82)), ink); btnBorder = "transparent"; }
  const btnRadius = buttonShape === "pill" ? "9999px" : buttonShape === "sharp" ? "0px" : RADIUS_PX[radius === "none" ? "sm" : radius];

  const df = FONTS[fontDisplay];
  const bf = FONTS[fontBody];
  const families = fontDisplay === fontBody ? [df] : [df, bf];

  const gap = DENSITY_GAP[density];

  const vars: Record<string, string> = {
    "--st-font-display": `"${df.family}", ${df.stack}`,
    "--st-font-body": `"${bf.family}", ${bf.stack}`,
    "--st-bg": bg,
    "--st-fg": ink,
    "--st-surface": surface === bg ? rgbToHex(mix(base.bg, base.ink, 0.03)) : surface,
    "--st-surface-alt": surfaceAlt,
    "--st-border": border,
    "--st-border-strong": borderStrong,
    "--st-muted-fg": mutedInk,
    "--st-accent": accent,
    "--st-accent-fg": accentInk,
    // Contrast-safe accent for filled *sections* (not just buttons): white/dark
    // body text on this ground always clears WCAG AA, where the raw accent can
    // sit a hair under for a bright mid-tone.
    "--st-brand-bg": solid.bg,
    "--st-brand-fg": solid.fg,
    "--st-contrast-bg": contrastPanel,
    "--st-contrast-fg": readableInk(contrastPanel),
    "--st-radius": RADIUS_PX[radius],
    "--st-radius-sm": RADIUS_PX[radius === "none" ? "none" : radius === "pill" ? "lg" : "sm"],
    "--st-radius-button": btnRadius,
    "--st-btn-bg": btnBg,
    "--st-btn-fg": btnFg,
    "--st-btn-border": btnBorder,
    "--st-heading-weight": String(headingWeight),
    "--st-heading-transform": headingTransform,
    "--st-heading-spacing": headingTransform === "uppercase" ? "0.06em" : "-0.02em",
    "--st-section-gap": gap.section,
    "--st-section-gap-sm": gap.sectionSm,
    "--st-image-ratio": RATIO_CSS[imageRatio],
    "--st-motion": motion === "none" ? "0" : "1",
  };

  return { direction: theme.direction, fontDisplay, fontBody, vars, fontFamilies: families, motion, cardStyle, header };
}

/** Builds the Google Fonts stylesheet URL for a resolved theme (or null). */
export function googleFontsHref(theme: ResolvedTheme): string | null {
  if (!theme.fontFamilies.length) return null;
  const families = theme.fontFamilies
    .map((f) => `family=${f.family.replace(/ /g, "+")}:wght@${[...new Set(f.weights)].sort((a, b) => a - b).join(";")}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** Serialises resolved vars for a style attribute. */
export function themeStyle(theme: ResolvedTheme): Record<string, string> {
  return theme.vars;
}
