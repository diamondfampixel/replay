import { z } from "zod";
import { DEFAULT_DNA, dnaDefaults, dnaOverrideSchema, dnaSchema, mergeDna, type DesignDNA } from "@/lib/storefront/dna";
import { sanitizeCustomCss } from "@/lib/storefront/custom-css";

/**
 * Storefront design system (v2).
 *
 * Layers, lowest to highest:
 *   Design DNA  → token defaults the store's character implies
 *   Direction   → a preset: DNA + font pairing + a few opinionated tokens
 *   Store theme → per-store overrides in nine groups (colours, type, layout,
 *                 shape, surface, buttons, cards, header/footer/product/
 *                 collection layouts, motion) plus scoped custom CSS
 *   Section     → per-section design overrides (see sections.ts)
 *
 * Everything resolves to `--st-*` CSS custom properties on the storefront
 * root plus a few data attributes; components read tokens, never literals.
 * v1 stores stored a handful of flat keys — those still parse and still win
 * over their DNA defaults, so no existing storefront changes on upgrade.
 */

// ---------------------------------------------------------------------------
// Fonts — curated pairing pool of open-licence Google Fonts.
// ---------------------------------------------------------------------------
type FontDef = { family: string; weights: number[]; stack: string; category: "sans" | "serif" | "display" | "mono" };

export const FONTS = {
  inter: { family: "Inter", weights: [400, 500, 600, 700], stack: "system-ui, sans-serif", category: "sans" },
  geist: { family: "Geist", weights: [400, 500, 600, 700], stack: "system-ui, sans-serif", category: "sans" },
  schibsted: { family: "Schibsted Grotesk", weights: [500, 600, 700], stack: "system-ui, sans-serif", category: "sans" },
  spaceGrotesk: { family: "Space Grotesk", weights: [400, 500, 600, 700], stack: "system-ui, sans-serif", category: "sans" },
  archivo: { family: "Archivo", weights: [500, 600, 700, 800, 900], stack: "system-ui, sans-serif", category: "display" },
  anton: { family: "Anton", weights: [400], stack: "Impact, system-ui, sans-serif", category: "display" },
  bebas: { family: "Bebas Neue", weights: [400], stack: "Impact, system-ui, sans-serif", category: "display" },
  syne: { family: "Syne", weights: [500, 600, 700, 800], stack: "system-ui, sans-serif", category: "display" },
  unbounded: { family: "Unbounded", weights: [500, 600, 700], stack: "system-ui, sans-serif", category: "display" },
  fraunces: { family: "Fraunces", weights: [400, 500, 600, 700], stack: "Georgia, serif", category: "serif" },
  playfair: { family: "Playfair Display", weights: [500, 600, 700], stack: "Georgia, serif", category: "serif" },
  cormorant: { family: "Cormorant Garamond", weights: [500, 600, 700], stack: "Georgia, serif", category: "serif" },
  dmSerif: { family: "DM Serif Display", weights: [400], stack: "Georgia, serif", category: "serif" },
  lora: { family: "Lora", weights: [400, 500, 600], stack: "Georgia, serif", category: "serif" },
  poppins: { family: "Poppins", weights: [400, 500, 600, 700], stack: "system-ui, sans-serif", category: "sans" },
  fredoka: { family: "Fredoka", weights: [400, 500, 600, 700], stack: "system-ui, sans-serif", category: "display" },
  jost: { family: "Jost", weights: [400, 500, 600], stack: "system-ui, sans-serif", category: "sans" },
  dmSans: { family: "DM Sans", weights: [400, 500, 700], stack: "system-ui, sans-serif", category: "sans" },
  nunito: { family: "Nunito Sans", weights: [400, 600, 700], stack: "system-ui, sans-serif", category: "sans" },
  plexSans: { family: "IBM Plex Sans", weights: [400, 500, 600], stack: "system-ui, sans-serif", category: "sans" },
  libreFranklin: { family: "Libre Franklin", weights: [400, 500, 600, 700], stack: "system-ui, sans-serif", category: "sans" },
  manrope: { family: "Manrope", weights: [400, 500, 600, 700, 800], stack: "system-ui, sans-serif", category: "sans" },
  plexMono: { family: "IBM Plex Mono", weights: [400, 500], stack: "ui-monospace, monospace", category: "mono" },
  splineMono: { family: "Spline Sans Mono", weights: [400, 500], stack: "ui-monospace, monospace", category: "mono" },
} satisfies Record<string, FontDef>;

export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as [FontKey, ...FontKey[]];

// ---------------------------------------------------------------------------
// Token vocabularies
// ---------------------------------------------------------------------------
export const RADII = ["none", "xs", "sm", "md", "lg", "xl", "pill"] as const;
export const BUTTON_STYLES = ["solid", "outline", "soft", "underline"] as const;
export const BUTTON_SHAPES = ["sharp", "rounded", "pill"] as const;
export const BUTTON_SIZES = ["sm", "md", "lg"] as const;
export const BUTTON_HOVERS = ["none", "brighten", "lift", "fill"] as const;
export const DENSITIES = ["compact", "comfortable", "spacious"] as const;
export const CARD_STYLES = ["minimal", "framed", "editorial", "elevated", "overlay"] as const;
export const CARD_HOVERS = ["none", "zoom", "lift", "swap"] as const;
export const IMAGE_RATIOS = ["square", "portrait", "landscape", "tall", "wide"] as const;
export const HEADING_TRANSFORMS = ["none", "uppercase"] as const;
export const NEUTRAL_TEMPS = ["warm", "cool", "pure", "sand", "slate", "ink", "midnight"] as const;
export const MOTION_LEVELS = ["off", "subtle", "balanced", "expressive"] as const;
export const REVEAL_STYLES = ["none", "fade", "slide", "scale", "blur"] as const;
export const HEADER_STYLES = ["classic", "centered", "split", "minimal", "transparent"] as const;
export const FOOTER_STYLES = ["columns", "minimal", "centered", "brand"] as const;
export const PRODUCT_LAYOUTS = ["mediaLeft", "gallery", "stacked", "stickyInfo", "minimal", "immersive"] as const;
export const PRODUCT_BLOCKS = [
  "vendor", "title", "rating", "price", "variants", "quantityBuy", "inventory", "trust", "description", "details", "tags", "share",
] as const;
export const PAGE_WIDTHS = ["narrow", "standard", "wide", "full"] as const;
export const SECTION_SPACINGS = ["tight", "normal", "airy"] as const;
export const GRID_GAPS = ["sm", "md", "lg"] as const;
export const SHADOWS = ["none", "soft", "medium", "strong"] as const;
export const COLLECTION_HEROES = ["none", "text", "banner"] as const;

export const DESIGN_DIRECTIONS = [
  "modern", "editorial", "minimal", "bold", "luxury", "playful", "technical", "organic", "energy", "creator",
] as const;
export type DesignDirection = (typeof DESIGN_DIRECTIONS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// ---------------------------------------------------------------------------
// Schema — nine groups + legacy flat keys. Everything optional.
// ---------------------------------------------------------------------------
export const colorRolesSchema = z.object({
  primary: hex.optional(), secondary: hex.optional(), background: hex.optional(), surface: hex.optional(),
  foreground: hex.optional(), muted: hex.optional(), border: hex.optional(), link: hex.optional(),
  sale: hex.optional(), success: hex.optional(), warning: hex.optional(),
  button: hex.optional(), buttonText: hex.optional(),
});
export const customSchemeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,24}$/), name: z.string().max(40), background: hex, foreground: hex, accent: hex.optional(),
});
export const typographySchema = z.object({
  display: z.enum(FONT_KEYS).optional(), body: z.enum(FONT_KEYS).optional(), accent: z.enum(FONT_KEYS).optional(),
  headingWeight: z.number().int().min(400).max(900).optional(), bodyWeight: z.union([z.literal(400), z.literal(500)]).optional(),
  headingTracking: z.number().min(-0.06).max(0.12).optional(), bodyLineHeight: z.number().min(1.3).max(1.9).optional(),
  headingScale: z.number().min(0.8).max(1.4).optional(), bodyScale: z.number().min(0.9).max(1.15).optional(),
  headingTransform: z.enum(HEADING_TRANSFORMS).optional(), eyebrowStyle: z.enum(["mono", "caps", "plain"]).optional(),
});
export const layoutSchema = z.object({
  width: z.enum(PAGE_WIDTHS).optional(), sectionSpacing: z.enum(SECTION_SPACINGS).optional(),
  gridGap: z.enum(GRID_GAPS).optional(), density: z.enum(DENSITIES).optional(),
});
export const shapeSchema = z.object({
  radius: z.enum(RADII).optional(), image: z.enum(RADII).optional(), card: z.enum(RADII).optional(),
  input: z.enum(["sharp", "rounded", "pill"]).optional(), badge: z.enum(["sharp", "rounded", "pill"]).optional(),
});
export const surfaceSchema = z.object({
  borderWidth: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(), shadow: z.enum(SHADOWS).optional(),
  glass: z.boolean().optional(),
});
export const buttonsSchema = z.object({
  style: z.enum(BUTTON_STYLES).optional(), shape: z.enum(BUTTON_SHAPES).optional(), size: z.enum(BUTTON_SIZES).optional(),
  uppercase: z.boolean().optional(), weight: z.number().int().min(400).max(800).optional(), hover: z.enum(BUTTON_HOVERS).optional(),
  secondaryStyle: z.enum(["outline", "ghost", "soft"]).optional(),
});
export const cardsSchema = z.object({
  style: z.enum(CARD_STYLES).optional(), ratio: z.enum(IMAGE_RATIOS).optional(), hover: z.enum(CARD_HOVERS).optional(),
  align: z.enum(["left", "center"]).optional(), showVendor: z.boolean().optional(), showRating: z.boolean().optional(),
  priceEmphasis: z.enum(["muted", "normal", "strong"]).optional(),
});
export const headerSchema = z.object({
  style: z.enum(HEADER_STYLES).optional(), sticky: z.boolean().optional(), logoSize: z.enum(["sm", "md", "lg"]).optional(),
  showSearch: z.boolean().optional(), showCart: z.boolean().optional(), border: z.boolean().optional(),
  navUppercase: z.boolean().optional(),
});
export const SOCIAL_KEYS = ["instagram", "tiktok", "x", "youtube", "linkedin", "facebook", "pinterest"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];
const socialUrl = z.string().max(200).regex(/^https:\/\/[^\s]+$/, "Must be an https:// link").or(z.literal(""));
/** Social profiles: a link renders only when its URL is set — never a dead placeholder. */
export const socialLinksSchema = z.object({
  instagram: socialUrl.optional(), tiktok: socialUrl.optional(), x: socialUrl.optional(), youtube: socialUrl.optional(),
  linkedin: socialUrl.optional(), facebook: socialUrl.optional(), pinterest: socialUrl.optional(),
});
export const footerSchema = z.object({
  style: z.enum(FOOTER_STYLES).optional(), showNewsletter: z.boolean().optional(), showSocial: z.boolean().optional(),
  brandStatement: z.string().max(240).optional(), scheme: z.enum(["base", "muted", "contrast"]).optional(),
  social: socialLinksSchema.optional(),
});
export const productSchema = z.object({
  layout: z.enum(PRODUCT_LAYOUTS).optional(), blocks: z.array(z.enum(PRODUCT_BLOCKS)).max(12).optional(),
  showReviews: z.boolean().optional(), showRecommended: z.boolean().optional(),
  trustItems: z.array(z.object({ text: z.string().max(80) })).max(4).optional(),
  imageRatio: z.enum(IMAGE_RATIOS).optional(),
});
export const collectionSchema = z.object({
  columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  mobileColumns: z.union([z.literal(1), z.literal(2)]).optional(),
  gap: z.enum(GRID_GAPS).optional(), showFilters: z.boolean().optional(), showCount: z.boolean().optional(),
  hero: z.enum(COLLECTION_HEROES).optional(), imageRatio: z.enum(IMAGE_RATIOS).optional(),
});
export const motionSchema = z.object({
  level: z.enum(MOTION_LEVELS).optional(), reveal: z.enum(REVEAL_STYLES).optional(), stagger: z.boolean().optional(),
  hover: z.enum(CARD_HOVERS).optional(), parallax: z.boolean().optional(), imageZoom: z.boolean().optional(),
  marqueeSpeed: z.enum(["slow", "normal", "fast"]).optional(),
});

const legacyMotion = z.enum(["none", "subtle", "expressive"]);

export const storeThemeSchema = z.object({
  direction: z.enum(DESIGN_DIRECTIONS).default("modern"),
  dna: dnaOverrideSchema.optional(),

  colors: colorRolesSchema.optional(),
  schemes: z.array(customSchemeSchema).max(3).optional(),
  typography: typographySchema.optional(),
  layout: layoutSchema.optional(),
  shape: shapeSchema.optional(),
  surface: surfaceSchema.optional(),
  buttons: buttonsSchema.optional(),
  cards: cardsSchema.optional(),
  headerConfig: headerSchema.optional(),
  footer: footerSchema.optional(),
  product: productSchema.optional(),
  collection: collectionSchema.optional(),
  motionConfig: motionSchema.optional(),
  customCss: z.string().max(20_000).optional(),

  // v1 flat keys — still honoured, still writable by the simple controls.
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
  motion: z.union([z.enum(MOTION_LEVELS), legacyMotion]).optional(),
  header: z.enum(HEADER_STYLES).optional(),
  accent: hex.optional(),
});

export type StoreTheme = z.infer<typeof storeThemeSchema>;

// ---------------------------------------------------------------------------
// Directions — DNA + pairing + a few opinionated tokens. Starting points only.
// ---------------------------------------------------------------------------
export type DirectionPreset = {
  label: string; blurb: string; dna: DesignDNA;
  fontDisplay: FontKey; fontBody: FontKey; fontAccent?: FontKey;
  neutral: (typeof NEUTRAL_TEMPS)[number]; header: (typeof HEADER_STYLES)[number]; footer: (typeof FOOTER_STYLES)[number];
  // Legacy flat token defaults (kept so the simple Design page keeps working).
  radius: (typeof RADII)[number]; buttonStyle: (typeof BUTTON_STYLES)[number]; buttonShape: (typeof BUTTON_SHAPES)[number];
  density: (typeof DENSITIES)[number]; cardStyle: (typeof CARD_STYLES)[number]; imageRatio: (typeof IMAGE_RATIOS)[number];
  headingTransform: (typeof HEADING_TRANSFORMS)[number]; headingWeight: number; motion: (typeof MOTION_LEVELS)[number];
  productLayout: (typeof PRODUCT_LAYOUTS)[number];
};

const d = (o: Partial<DesignDNA>): DesignDNA => ({ ...DEFAULT_DNA, ...o });

export const DIRECTION_PRESETS: Record<DesignDirection, DirectionPreset> = {
  modern: {
    label: "Modern", blurb: "Clean grotesk type, soft corners, confident and neutral. A safe, contemporary default.",
    dna: d({ expression: 45, era: 60, tone: 35, geometry: 60, edge: 45, density: 45, energy: 40 }),
    fontDisplay: "schibsted", fontBody: "inter", neutral: "cool", header: "classic", footer: "columns",
    radius: "md", buttonStyle: "solid", buttonShape: "rounded", density: "comfortable", cardStyle: "minimal",
    imageRatio: "square", headingTransform: "none", headingWeight: 600, motion: "subtle", productLayout: "mediaLeft",
  },
  editorial: {
    label: "Editorial", blurb: "Serif display over generous whitespace. Reads like a considered magazine.",
    dna: d({ expression: 55, era: 25, tone: 20, geometry: 40, edge: 80, density: 25, energy: 30 }),
    fontDisplay: "fraunces", fontBody: "inter", fontAccent: "splineMono", neutral: "warm", header: "centered", footer: "brand",
    radius: "none", buttonStyle: "outline", buttonShape: "sharp", density: "spacious", cardStyle: "editorial",
    imageRatio: "portrait", headingTransform: "none", headingWeight: 500, motion: "subtle", productLayout: "stacked",
  },
  minimal: {
    label: "Minimal", blurb: "Maximum restraint. Tight type, hairline detail, product-first.",
    dna: d({ expression: 20, era: 55, tone: 15, geometry: 70, edge: 85, density: 20, energy: 20 }),
    fontDisplay: "inter", fontBody: "inter", neutral: "pure", header: "minimal", footer: "minimal",
    radius: "none", buttonStyle: "solid", buttonShape: "sharp", density: "spacious", cardStyle: "minimal",
    imageRatio: "portrait", headingTransform: "none", headingWeight: 600, motion: "subtle", productLayout: "minimal",
  },
  bold: {
    label: "Bold", blurb: "Heavy condensed headlines, high contrast, energetic. Made to grab a scroller.",
    dna: d({ expression: 88, era: 55, tone: 40, geometry: 75, edge: 78, density: 55, energy: 70 }),
    fontDisplay: "archivo", fontBody: "libreFranklin", fontAccent: "plexMono", neutral: "slate", header: "classic", footer: "columns",
    radius: "sm", buttonStyle: "solid", buttonShape: "sharp", density: "comfortable", cardStyle: "framed",
    imageRatio: "square", headingTransform: "uppercase", headingWeight: 800, motion: "expressive", productLayout: "gallery",
  },
  luxury: {
    label: "Luxury", blurb: "High-contrast serif, wide letter-spacing, deep neutrals. Quiet, expensive restraint.",
    dna: d({ expression: 45, era: 20, tone: 5, geometry: 55, edge: 90, density: 15, energy: 20 }),
    fontDisplay: "cormorant", fontBody: "jost", fontAccent: "jost", neutral: "warm", header: "centered", footer: "centered",
    radius: "none", buttonStyle: "outline", buttonShape: "sharp", density: "spacious", cardStyle: "editorial",
    imageRatio: "tall", headingTransform: "uppercase", headingWeight: 600, motion: "subtle", productLayout: "immersive",
  },
  playful: {
    label: "Playful", blurb: "Round friendly type, pill shapes, bright and bouncy. Great for fun consumer brands.",
    dna: d({ expression: 70, era: 55, tone: 90, geometry: 30, edge: 10, density: 55, energy: 80 }),
    fontDisplay: "fredoka", fontBody: "nunito", neutral: "pure", header: "classic", footer: "columns",
    radius: "xl", buttonStyle: "solid", buttonShape: "pill", density: "comfortable", cardStyle: "elevated",
    imageRatio: "square", headingTransform: "none", headingWeight: 600, motion: "expressive", productLayout: "gallery",
  },
  technical: {
    label: "Technical", blurb: "Grotesk + mono accents, tight grid, precise. For tools, gear and hardware.",
    dna: d({ expression: 50, era: 85, tone: 20, geometry: 90, edge: 65, density: 75, energy: 50 }),
    fontDisplay: "spaceGrotesk", fontBody: "plexSans", fontAccent: "plexMono", neutral: "slate", header: "minimal", footer: "columns",
    radius: "sm", buttonStyle: "solid", buttonShape: "rounded", density: "compact", cardStyle: "framed",
    imageRatio: "landscape", headingTransform: "none", headingWeight: 600, motion: "balanced", productLayout: "stickyInfo",
  },
  organic: {
    label: "Organic", blurb: "Warm serif display, soft sand neutrals, unhurried. Skincare, wellness, food.",
    dna: d({ expression: 35, era: 30, tone: 40, geometry: 15, edge: 20, density: 25, energy: 25 }),
    fontDisplay: "dmSerif", fontBody: "nunito", neutral: "sand", header: "centered", footer: "brand",
    radius: "lg", buttonStyle: "soft", buttonShape: "pill", density: "spacious", cardStyle: "minimal",
    imageRatio: "portrait", headingTransform: "none", headingWeight: 500, motion: "subtle", productLayout: "stacked",
  },
  energy: {
    label: "High energy", blurb: "Big display type, dense stacked media, motion everywhere it earns its place.",
    dna: d({ expression: 95, era: 70, tone: 55, geometry: 80, edge: 75, density: 70, energy: 95 }),
    fontDisplay: "bebas", fontBody: "manrope", fontAccent: "plexMono", neutral: "midnight", header: "split", footer: "brand",
    radius: "xs", buttonStyle: "solid", buttonShape: "sharp", density: "compact", cardStyle: "overlay",
    imageRatio: "tall", headingTransform: "uppercase", headingWeight: 700, motion: "expressive", productLayout: "immersive",
  },
  creator: {
    label: "Creator", blurb: "Unconventional composition, oversized type, visual storytelling. A brand with a voice.",
    dna: d({ expression: 85, era: 60, tone: 65, geometry: 45, edge: 55, density: 60, energy: 75 }),
    fontDisplay: "syne", fontBody: "dmSans", fontAccent: "splineMono", neutral: "ink", header: "split", footer: "centered",
    radius: "md", buttonStyle: "solid", buttonShape: "pill", density: "comfortable", cardStyle: "overlay",
    imageRatio: "portrait", headingTransform: "none", headingWeight: 800, motion: "expressive", productLayout: "gallery",
  },
};

// ---------------------------------------------------------------------------
// Colour helpers (dependency-free; enough for a coordinated, AA-checked set).
// ---------------------------------------------------------------------------
type Rgb = { r: number; g: number; b: number };
function hexToRgb(h: string): Rgb {
  const n = h.replace("#", "");
  const s = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}
function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function mix(a: Rgb, b: Rgb, t: number): Rgb { return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }; }
function lum({ r, g, b }: Rgb): number {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrastRatio(a: string, b: string): number {
  const la = lum(hexToRgb(a)), lb = lum(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
function readableInk(bg: string, dark = "#141414", light = "#ffffff"): string {
  return contrastRatio(bg, dark) >= contrastRatio(bg, light) ? dark : light;
}
/** Solid fill that always clears AA with its text (darkens bright mid-tones). */
function solidFill(color: string): { bg: string; fg: string } {
  if (contrastRatio(color, "#ffffff") >= 4.5) return { bg: color, fg: "#ffffff" };
  if (contrastRatio(color, "#141414") >= 4.5) return { bg: color, fg: "#141414" };
  let rgb = hexToRgb(color);
  for (let i = 0; i < 16 && contrastRatio(rgbToHex(rgb), "#ffffff") < 4.5; i++) rgb = mix(rgb, { r: 0, g: 0, b: 0 }, 0.08);
  return { bg: rgbToHex(rgb), fg: "#ffffff" };
}
/** Nudges `fg` toward `ink` until it clears AA on `bg`. */
function ensureAA(fg: Rgb, bg: Rgb, ink: Rgb): string {
  let t = 0, c = fg;
  while (t < 1 && contrastRatio(rgbToHex(c), rgbToHex(bg)) < 4.5) { t += 0.05; c = mix(fg, ink, t); }
  return rgbToHex(c);
}

const NEUTRAL_BASE: Record<(typeof NEUTRAL_TEMPS)[number], { bg: string; ink: string; dark: boolean }> = {
  warm: { bg: "#faf8f4", ink: "#241f1a", dark: false },
  cool: { bg: "#fbfbfc", ink: "#16181d", dark: false },
  pure: { bg: "#ffffff", ink: "#111111", dark: false },
  sand: { bg: "#f7f2ea", ink: "#2a231b", dark: false },
  slate: { bg: "#f7f8fa", ink: "#12151b", dark: false },
  ink: { bg: "#0f1012", ink: "#f2f1ee", dark: true },
  midnight: { bg: "#0a0d14", ink: "#eef1f6", dark: true },
};

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------
export type ResolvedTheme = {
  direction: DesignDirection;
  dna: DesignDNA;
  fontDisplay: FontKey;
  fontBody: FontKey;
  fontAccent: FontKey;
  vars: Record<string, string>;
  fontFamilies: FontDef[];
  isDark: boolean;
  motion: (typeof MOTION_LEVELS)[number];
  motionConfig: Required<z.infer<typeof motionSchema>>;
  cardStyle: (typeof CARD_STYLES)[number];
  header: Required<z.infer<typeof headerSchema>>;
  footer: Required<Omit<z.infer<typeof footerSchema>, "brandStatement" | "social">> & {
    brandStatement: string | null;
    /** Only the networks with a real URL. */
    social: Array<{ key: SocialKey; url: string }>;
  };
  eyebrowStyle: "mono" | "caps" | "plain";
  product: Required<Omit<z.infer<typeof productSchema>, "trustItems">> & { trustItems: Array<{ text: string }> };
  collection: Required<z.infer<typeof collectionSchema>>;
  layout: Required<z.infer<typeof layoutSchema>>;
  buttons: Required<z.infer<typeof buttonsSchema>>;
  cards: Required<z.infer<typeof cardsSchema>>;
  schemes: Array<{ id: string; name: string; background: string; foreground: string; accent: string }>;
  customCss: string;
  customCssWarnings: string[];
};

const RADIUS_PX: Record<(typeof RADII)[number], string> = { none: "0px", xs: "3px", sm: "6px", md: "10px", lg: "16px", xl: "24px", pill: "9999px" };
const RATIO_CSS: Record<(typeof IMAGE_RATIOS)[number], string> = { square: "1 / 1", portrait: "4 / 5", landscape: "4 / 3", tall: "3 / 4", wide: "16 / 9" };
const WIDTH_PX: Record<(typeof PAGE_WIDTHS)[number], string> = { narrow: "1040px", standard: "1200px", wide: "1440px", full: "100%" };
const GAP_PX: Record<(typeof GRID_GAPS)[number], string> = { sm: "12px", md: "20px", lg: "32px" };
const DENSITY_GAP: Record<(typeof DENSITIES)[number], [number, number]> = { compact: [40, 56], comfortable: [56, 80], spacious: [72, 112] };
const SPACING_MULT: Record<(typeof SECTION_SPACINGS)[number], number> = { tight: 0.75, normal: 1, airy: 1.3 };
const SHADOW_CSS: Record<(typeof SHADOWS)[number], string> = {
  none: "none", soft: "0 1px 2px rgba(0,0,0,.05), 0 10px 30px -18px rgba(0,0,0,.25)",
  medium: "0 2px 4px rgba(0,0,0,.06), 0 16px 40px -18px rgba(0,0,0,.35)", strong: "0 4px 10px rgba(0,0,0,.08), 0 30px 60px -20px rgba(0,0,0,.45)",
};
const BTN_H: Record<(typeof BUTTON_SIZES)[number], string> = { sm: "2.5rem", md: "2.9rem", lg: "3.3rem" };

export function resolveTheme(input: { theme?: unknown; primaryColor: string; secondaryColor?: string }): ResolvedTheme {
  const parsed = storeThemeSchema.safeParse(input.theme ?? {});
  const t: StoreTheme = parsed.success ? parsed.data : storeThemeSchema.parse({});
  const preset = DIRECTION_PRESETS[t.direction];

  // 1. DNA: preset DNA, then per-store axis overrides.
  const dna: DesignDNA = mergeDna(dnaSchema.parse(preset.dna), t.dna);
  const derived = dnaDefaults(dna);

  // 2. Tokens: DNA defaults ← preset opinions ← v1 flat keys ← v2 groups.
  const ty = t.typography ?? {};
  const fontDisplay = ty.display ?? t.fontDisplay ?? preset.fontDisplay;
  const fontBody = ty.body ?? t.fontBody ?? preset.fontBody;
  const fontAccent = ty.accent ?? preset.fontAccent ?? fontBody;
  const headingWeight = ty.headingWeight ?? t.headingWeight ?? preset.headingWeight ?? derived.headingWeight;
  const headingTransform = ty.headingTransform ?? t.headingTransform ?? preset.headingTransform ?? derived.headingTransform;
  const headingTracking = ty.headingTracking ?? (headingTransform === "uppercase" ? 0.06 : derived.headingTracking);
  const headingScale = ty.headingScale ?? derived.headingScale;
  const bodyScale = ty.bodyScale ?? 1;
  const bodyLineHeight = ty.bodyLineHeight ?? (dna.density >= 66 ? 1.5 : 1.65);
  const bodyWeight = ty.bodyWeight ?? 400;
  const eyebrowStyle = ty.eyebrowStyle ?? (preset.fontAccent ? "mono" : "caps");

  const lay = t.layout ?? {};
  const density = lay.density ?? t.density ?? preset.density ?? derived.density;
  const width = lay.width ?? (dna.density <= 30 ? "standard" : dna.density >= 70 ? "wide" : "standard");
  const sectionSpacing = lay.sectionSpacing ?? "normal";
  const gridGap = lay.gridGap ?? (density === "compact" ? "sm" : density === "spacious" ? "lg" : "md");

  const sh = t.shape ?? {};
  const radius = sh.radius ?? t.radius ?? preset.radius ?? derived.radius;
  const imageRadius = sh.image ?? radius;
  const cardRadius = sh.card ?? radius;
  const inputShape = sh.input ?? (radius === "pill" ? "pill" : radius === "none" ? "sharp" : "rounded");
  const badgeShape = sh.badge ?? (dna.tone >= 55 ? "pill" : radius === "none" ? "sharp" : "rounded");

  const su = t.surface ?? {};
  const borderWidth = su.borderWidth ?? derived.borderWidth;
  const shadow = su.shadow ?? derived.surfaceShadow;
  const glass = su.glass ?? false;

  const bt = t.buttons ?? {};
  const buttonStyle = bt.style ?? t.buttonStyle ?? preset.buttonStyle ?? derived.buttonStyle;
  const buttonShape = bt.shape ?? t.buttonShape ?? preset.buttonShape ?? derived.buttonShape;
  const buttonSize = bt.size ?? (dna.expression >= 70 ? "lg" : "md");
  const buttonUpper = bt.uppercase ?? (headingTransform === "uppercase" && dna.expression >= 70);
  const buttonWeight = bt.weight ?? 600;
  const buttonHover = bt.hover ?? (dna.energy >= 60 ? "lift" : "brighten");
  const secondaryStyle = bt.secondaryStyle ?? "outline";

  const cd = t.cards ?? {};
  const cardStyle = cd.style ?? t.cardStyle ?? preset.cardStyle ?? derived.cardStyle;
  const cardRatio = cd.ratio ?? t.imageRatio ?? preset.imageRatio ?? derived.imageRatio;
  const mo = t.motionConfig ?? {};
  const cardHover = cd.hover ?? mo.hover ?? derived.hover;
  const cardAlign = cd.align ?? (preset.header === "centered" ? "center" : "left");
  const cardShowVendor = cd.showVendor ?? false;
  const cardShowRating = cd.showRating ?? true;
  const priceEmphasis = cd.priceEmphasis ?? "normal";

  const legacyMotionLevel = t.motion === "none" ? "off" : (t.motion as (typeof MOTION_LEVELS)[number] | undefined);
  const motionLevel = mo.level ?? legacyMotionLevel ?? preset.motion ?? derived.motionLevel;
  const motionConfig = {
    level: motionLevel,
    reveal: mo.reveal ?? (motionLevel === "off" ? "none" : derived.reveal === "none" ? "fade" : derived.reveal),
    stagger: mo.stagger ?? motionLevel !== "off",
    hover: mo.hover ?? cardHover,
    parallax: mo.parallax ?? (motionLevel === "expressive" || motionLevel === "balanced"),
    imageZoom: mo.imageZoom ?? motionLevel !== "off",
    marqueeSpeed: mo.marqueeSpeed ?? (dna.energy >= 70 ? "fast" : "normal"),
  } satisfies Required<z.infer<typeof motionSchema>>;

  const hd = t.headerConfig ?? {};
  const header = {
    style: hd.style ?? t.header ?? preset.header,
    sticky: hd.sticky ?? true,
    logoSize: hd.logoSize ?? "md",
    showSearch: hd.showSearch ?? true,
    showCart: hd.showCart ?? true,
    border: hd.border ?? true,
    navUppercase: hd.navUppercase ?? (headingTransform === "uppercase"),
  } satisfies Required<z.infer<typeof headerSchema>>;

  const ft = t.footer ?? {};
  const footer = {
    style: ft.style ?? preset.footer,
    showNewsletter: ft.showNewsletter ?? false,
    showSocial: ft.showSocial ?? true,
    brandStatement: ft.brandStatement ?? null,
    scheme: ft.scheme ?? "muted",
    social: SOCIAL_KEYS.flatMap((key) => {
      const url = ft.social?.[key];
      return url ? [{ key, url }] : [];
    }),
  };

  const pr = t.product ?? {};
  const product = {
    layout: pr.layout ?? preset.productLayout,
    blocks: pr.blocks ?? ["vendor", "title", "rating", "price", "variants", "quantityBuy", "inventory", "trust", "description", "tags"],
    showReviews: pr.showReviews ?? true,
    showRecommended: pr.showRecommended ?? true,
    trustItems: pr.trustItems ?? [],
    imageRatio: pr.imageRatio ?? cardRatio,
  };

  const co = t.collection ?? {};
  const collection = {
    columns: co.columns ?? (density === "compact" ? 4 : density === "spacious" ? 3 : 4),
    mobileColumns: co.mobileColumns ?? 2,
    gap: co.gap ?? gridGap,
    showFilters: co.showFilters ?? true,
    showCount: co.showCount ?? true,
    hero: co.hero ?? "text",
    imageRatio: co.imageRatio ?? cardRatio,
  } satisfies Required<z.infer<typeof collectionSchema>>;

  // 3. Colours: roles from overrides, else derived from neutral + accent.
  const neutral = t.neutral ?? preset.neutral;
  const base = NEUTRAL_BASE[neutral];
  const cr = t.colors ?? {};
  const bg = cr.background ?? base.bg;
  const ink = cr.foreground ?? base.ink;
  const bgRgb = hexToRgb(bg), inkRgb = hexToRgb(ink);
  const isDark = lum(bgRgb) < 0.3;
  const accent = cr.primary ?? t.accent ?? input.primaryColor;
  const secondary = cr.secondary ?? input.secondaryColor ?? ink;
  const surface = cr.surface ?? rgbToHex(mix(bgRgb, isDark ? { r: 255, g: 255, b: 255 } : inkRgb, isDark ? 0.06 : 0.03));
  const surfaceAlt = rgbToHex(mix(bgRgb, inkRgb, isDark ? 0.08 : 0.05));
  const border = cr.border ?? rgbToHex(mix(bgRgb, inkRgb, isDark ? 0.18 : 0.14));
  const borderStrong = rgbToHex(mix(bgRgb, inkRgb, isDark ? 0.3 : 0.24));
  const muted = cr.muted ?? ensureAA(mix(bgRgb, inkRgb, 0.62), hexToRgb(surfaceAlt), inkRgb);
  const accentInk = readableInk(accent);
  const contrastBg = isDark ? rgbToHex(mix(bgRgb, { r: 255, g: 255, b: 255 }, 0.92)) : rgbToHex(mix(inkRgb, { r: 0, g: 0, b: 0 }, 0.15));
  const contrastFg = readableInk(contrastBg);
  const brand = solidFill(accent);
  const link = cr.link ?? (contrastRatio(accent, bg) >= 4.5 ? accent : ink);
  const sale = cr.sale ?? "#b4331f";
  const success = cr.success ?? "#0e7c66";
  const warning = cr.warning ?? "#a1660a";

  const btnFill = cr.button ? solidFill(cr.button) : brand;
  let btnBg = btnFill.bg, btnFg = cr.buttonText ?? btnFill.fg, btnBorder = btnFill.bg;
  if (buttonStyle === "outline") { btnBg = "transparent"; btnFg = ink; btnBorder = borderStrong; }
  if (buttonStyle === "soft") { const soft = rgbToHex(mix(hexToRgb(accent), bgRgb, 0.82)); btnBg = soft; btnFg = readableInk(soft, ink); btnBorder = "transparent"; }
  if (buttonStyle === "underline") { btnBg = "transparent"; btnFg = ink; btnBorder = "transparent"; }
  const btnRadius = buttonShape === "pill" ? "9999px" : buttonShape === "sharp" ? "0px" : RADIUS_PX[radius === "none" ? "sm" : radius === "pill" ? "lg" : radius];

  const schemes = (t.schemes ?? []).map((s) => ({ ...s, accent: s.accent ?? accent }));

  const df = FONTS[fontDisplay], bf = FONTS[fontBody], af = FONTS[fontAccent];
  const families = [df, bf, af].filter((f, i, arr) => arr.findIndex((x) => x.family === f.family) === i);

  const [gapA, gapB] = DENSITY_GAP[density].map((v) => Math.round(v * SPACING_MULT[sectionSpacing])) as [number, number];

  const custom = sanitizeCustomCss(t.customCss);

  const vars: Record<string, string> = {
    "--st-font-display": `"${df.family}", ${df.stack}`,
    "--st-font-body": `"${bf.family}", ${bf.stack}`,
    "--st-font-accent": `"${af.family}", ${af.stack}`,
    "--st-eyebrow-font": eyebrowStyle === "mono" ? `"${af.family}", ${af.stack}` : `"${bf.family}", ${bf.stack}`,
    "--st-eyebrow-transform": eyebrowStyle === "plain" ? "none" : "uppercase",
    "--st-eyebrow-tracking": eyebrowStyle === "plain" ? "0" : eyebrowStyle === "mono" ? "0.08em" : "0.12em",
    "--st-bg": bg, "--st-fg": ink, "--st-surface": surface, "--st-surface-alt": surfaceAlt,
    "--st-border": border, "--st-border-strong": borderStrong, "--st-muted-fg": muted,
    "--st-accent": accent, "--st-accent-fg": accentInk, "--st-secondary": secondary,
    "--st-brand-bg": brand.bg, "--st-brand-fg": brand.fg,
    "--st-contrast-bg": contrastBg, "--st-contrast-fg": contrastFg,
    "--st-link": link, "--st-sale": sale, "--st-success": success, "--st-warning": warning,
    "--st-radius": RADIUS_PX[radius], "--st-radius-sm": RADIUS_PX[radius === "none" ? "none" : radius === "pill" ? "lg" : "sm"],
    "--st-radius-image": RADIUS_PX[imageRadius], "--st-radius-card": RADIUS_PX[cardRadius],
    "--st-radius-input": inputShape === "pill" ? "9999px" : inputShape === "sharp" ? "0px" : "8px",
    "--st-radius-badge": badgeShape === "pill" ? "9999px" : badgeShape === "sharp" ? "0px" : "6px",
    "--st-radius-button": btnRadius,
    "--st-btn-bg": btnBg, "--st-btn-fg": btnFg, "--st-btn-border": btnBorder, "--st-btn-h": BTN_H[buttonSize],
    "--st-btn-weight": String(buttonWeight), "--st-btn-transform": buttonUpper ? "uppercase" : "none",
    "--st-btn-tracking": buttonUpper ? "0.08em" : "-0.01em",
    "--st-heading-weight": String(headingWeight), "--st-heading-transform": headingTransform,
    "--st-heading-spacing": `${headingTracking}em`, "--st-heading-scale": String(headingScale),
    "--st-body-scale": String(bodyScale), "--st-body-lh": String(bodyLineHeight), "--st-body-weight": String(bodyWeight),
    "--st-section-gap": `${gapA}px`, "--st-section-gap-sm": `${gapB}px`,
    "--st-max-width": WIDTH_PX[width], "--st-grid-gap": GAP_PX[gridGap],
    "--st-image-ratio": RATIO_CSS[cardRatio], "--st-product-ratio": RATIO_CSS[product.imageRatio],
    "--st-collection-ratio": RATIO_CSS[collection.imageRatio],
    "--st-border-w": `${borderWidth}px`, "--st-shadow": SHADOW_CSS[shadow],
    "--st-glass": glass ? "blur(12px)" : "none",
    "--st-motion": motionLevel === "off" ? "0" : "1",
    "--st-marquee-dur": motionConfig.marqueeSpeed === "fast" ? "18s" : motionConfig.marqueeSpeed === "slow" ? "60s" : "34s",
  };
  for (const s of schemes) {
    vars[`--st-scheme-${s.id}-bg`] = s.background; vars[`--st-scheme-${s.id}-fg`] = s.foreground; vars[`--st-scheme-${s.id}-accent`] = s.accent;
  }

  return {
    direction: t.direction, dna, fontDisplay, fontBody, fontAccent, vars, fontFamilies: families, isDark,
    motion: motionLevel, motionConfig, cardStyle, header, footer, product, collection, eyebrowStyle,
    layout: { width, sectionSpacing, gridGap, density },
    buttons: { style: buttonStyle, shape: buttonShape, size: buttonSize, uppercase: buttonUpper, weight: buttonWeight, hover: buttonHover, secondaryStyle },
    cards: { style: cardStyle, ratio: cardRatio, hover: cardHover, align: cardAlign, showVendor: cardShowVendor, showRating: cardShowRating, priceEmphasis },
    schemes, customCss: custom.css, customCssWarnings: custom.warnings,
  };
}

export function googleFontsHref(theme: ResolvedTheme): string | null {
  if (!theme.fontFamilies.length) return null;
  const families = theme.fontFamilies
    .map((f) => `family=${f.family.replace(/ /g, "+")}:wght@${[...new Set(f.weights)].sort((a, b) => a - b).join(";")}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

export function themeStyle(theme: ResolvedTheme): Record<string, string> { return theme.vars; }

/** Accessibility warnings the editor surfaces (never silently ignored). */
export function themeWarnings(theme: ResolvedTheme): string[] {
  const w = [...theme.customCssWarnings];
  const body = contrastRatio(theme.vars["--st-fg"], theme.vars["--st-bg"]);
  if (body < 4.5) w.push(`Body text contrast is ${body.toFixed(1)}:1 — below the 4.5:1 accessibility minimum.`);
  const btn = theme.vars["--st-btn-bg"] === "transparent" ? 21 : contrastRatio(theme.vars["--st-btn-fg"], theme.vars["--st-btn-bg"]);
  if (btn < 4.5) w.push(`Button text contrast is ${btn.toFixed(1)}:1 — choose a darker or lighter button colour.`);
  for (const s of theme.schemes) {
    const c = contrastRatio(s.foreground, s.background);
    if (c < 4.5) w.push(`Custom scheme "${s.name}" has ${c.toFixed(1)}:1 contrast — text will be hard to read.`);
  }
  return w;
}
