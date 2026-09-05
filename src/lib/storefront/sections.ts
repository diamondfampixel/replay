import { z } from "zod";
import type { ResolvedTheme } from "@/lib/storefront/theme";

/**
 * The section contract (v2).
 *
 * PAGE → SECTION → BLOCKS. A page is an ordered list of sections; each is a
 * type plus JSON config. Config = content fields + an optional `layout`
 * (composition) + `blocks` (typed repeatable items) + a shared `design`
 * object every section understands. Renderer, editor and AI all read and
 * write exactly this shape — the model never emits React source.
 *
 * v1 configs still parse: every new key has a default, and the old
 * `background`/`spacing` keys are folded into `design` at normalise time.
 */

// ---------------------------------------------------------------------------
// Shared vocabularies
// ---------------------------------------------------------------------------
export const SECTION_SCHEMES = ["base", "muted", "accent", "contrast", "custom"] as const;
export const SECTION_WIDTHS = ["narrow", "contained", "wide", "full"] as const;
export const SECTION_PADS = ["none", "sm", "md", "lg", "xl"] as const;
export const SECTION_ALIGNS = ["left", "center", "right"] as const;
export const SECTION_MOTIONS = ["inherit", "off", "subtle", "expressive"] as const;
export const SECTION_REVEALS = ["inherit", "none", "fade", "slide", "scale", "blur"] as const;
export const HEIGHTS = ["auto", "small", "medium", "large", "screen"] as const;

/** Per-section design overrides. Global tokens establish consistency; these bend one section. */
export const designSchema = z.object({
  scheme: z.enum(SECTION_SCHEMES).default("base"),
  customScheme: z.string().max(24).default(""),
  width: z.enum(SECTION_WIDTHS).default("contained"),
  paddingTop: z.enum(SECTION_PADS).default("md"),
  paddingBottom: z.enum(SECTION_PADS).default("md"),
  align: z.enum(SECTION_ALIGNS).default("left"),
  motion: z.enum(SECTION_MOTIONS).default("inherit"),
  reveal: z.enum(SECTION_REVEALS).default("inherit"),
  border: z.enum(["none", "top", "bottom", "both"]).default("none"),
  /** Mobile overrides — only what genuinely matters on a phone. */
  mobileAlign: z.enum(["inherit", "left", "center"]).default("inherit"),
  mobileHide: z.boolean().default(false),
});
export type SectionDesign = z.infer<typeof designSchema>;

/** Media object: an image with the metadata a real storefront needs. */
export const mediaSchema = z.object({
  url: z.string().max(2000).nullable().default(null),
  alt: z.string().max(200).default(""),
  /** Focal point as percentages, drives object-position and mobile crops. */
  focalX: z.number().min(0).max(100).default(50),
  focalY: z.number().min(0).max(100).default(50),
  /** 0–90 darkening overlay for legibility of overlaid copy. */
  overlay: z.number().min(0).max(90).default(0),
  mobileUrl: z.string().max(2000).nullable().default(null),
});
export type Media = z.infer<typeof mediaSchema>;
export type SectionMedia = Media;

// ---------------------------------------------------------------------------
// Section types
// ---------------------------------------------------------------------------
export const SECTION_TYPES = [
  // hero / brand
  "announcement", "hero", "imageHero", "videoHero", "marquee",
  // product
  "featuredProducts", "productGrid", "featuredProduct", "collectionGrid", "collectionHero",
  // content
  "text", "imageText", "gallery", "fullImage", "stats", "logoList", "quote", "story", "benefits", "testimonials", "reviews", "faq",
  // conversion
  "newsletter", "customBanner", "valueProps",
  // premium — only available with a premium theme (see PREMIUM_SECTION_TYPES)
  "lookbook", "specSheet", "dropCountdown",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/**
 * Sections that ship only with premium themes. They are what makes a paid
 * theme structurally different from an included one: an included theme can be
 * recoloured and recomposed, but it cannot reach these.
 */
export const PREMIUM_SECTION_TYPES = ["lookbook", "specSheet", "dropCountdown"] as const satisfies readonly SectionType[];
export function isPremiumSection(type: string): boolean {
  return (PREMIUM_SECTION_TYPES as readonly string[]).includes(type);
}

const base = { design: designSchema.default(() => designSchema.parse({})) };

export const sectionSchemas = {
  announcement: z.object({
    text: z.string().max(160).default("Free shipping on orders over $75"),
    link: z.string().max(200).default("/shop"),
    background: z.enum(["ink", "brand", "muted"]).default("ink"),
    layout: z.enum(["static", "marquee"]).default("static"),
    ...base,
  }),

  hero: z.object({
    layout: z.enum(["left", "center", "split", "fullBleed", "editorial", "minimal", "asymmetric"]).default("left"),
    eyebrow: z.string().max(60).default(""),
    headline: z.string().max(140).default("A better everyday"),
    subheadline: z.string().max(280).default(""),
    ctaLabel: z.string().max(40).default("Shop now"),
    ctaHref: z.string().max(200).default("/shop"),
    secondaryCtaLabel: z.string().max(40).default(""),
    secondaryCtaHref: z.string().max(200).default(""),
    align: z.enum(["left", "center"]).default("left"),
    background: z.enum(["white", "muted", "brand"]).default("muted"),
    imageUrl: z.string().nullable().default(null),
    media: mediaSchema.default(() => mediaSchema.parse({})),
    height: z.enum(HEIGHTS).default("large"),
    headingSize: z.enum(["md", "lg", "xl", "display"]).default("lg"),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  imageHero: z.object({
    layout: z.enum(["overlay", "bottomLeft", "centered", "editorial"]).default("overlay"),
    eyebrow: z.string().max(60).default(""),
    headline: z.string().max(140).default(""),
    subheadline: z.string().max(280).default(""),
    ctaLabel: z.string().max(40).default("Shop now"),
    ctaHref: z.string().max(200).default("/shop"),
    imageUrl: z.string().nullable().default(null),
    media: mediaSchema.default(() => mediaSchema.parse({})),
    overlay: z.number().min(0).max(90).default(30),
    align: z.enum(["left", "center"]).default("center"),
    height: z.enum(HEIGHTS).default("large"),
    parallax: z.boolean().default(true),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  videoHero: z.object({
    videoUrl: z.string().max(2000).nullable().default(null),
    posterUrl: z.string().max(2000).nullable().default(null),
    eyebrow: z.string().max(60).default(""),
    headline: z.string().max(140).default(""),
    subheadline: z.string().max(280).default(""),
    ctaLabel: z.string().max(40).default("Shop now"),
    ctaHref: z.string().max(200).default("/shop"),
    overlay: z.number().min(0).max(90).default(35),
    align: z.enum(["left", "center"]).default("center"),
    height: z.enum(HEIGHTS).default("large"),
    ...base,
  }),

  marquee: z.object({
    items: z.array(z.object({ text: z.string().max(80) })).max(12).default([{ text: "Free shipping over $75" }, { text: "New drop every month" }]),
    size: z.enum(["sm", "md", "lg", "xl"]).default("md"),
    separator: z.string().max(4).default("·"),
    direction: z.enum(["left", "right"]).default("left"),
    ...base,
  }),

  featuredProducts: z.object({
    layout: z.enum(["grid", "carousel", "asymmetric", "editorial", "list"]).default("grid"),
    heading: z.string().max(120).default("Featured"),
    subheading: z.string().max(200).default(""),
    source: z.enum(["collection", "manual", "bestsellers", "newest"]).default("newest"),
    collectionSlug: z.string().max(120).default(""),
    productIds: z.array(z.string()).default([]),
    limit: z.number().int().min(2).max(12).default(4),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(4),
    mobileColumns: z.union([z.literal(1), z.literal(2)]).default(2),
    ctaLabel: z.string().max(40).default(""),
    ctaHref: z.string().max(200).default("/shop"),
    background: z.enum(["white", "muted", "brand", "ink"]).default("white"),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  productGrid: z.object({
    heading: z.string().max(120).default("All products"),
    limit: z.number().int().min(3).max(48).default(12),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(4),
    mobileColumns: z.union([z.literal(1), z.literal(2)]).default(2),
    background: z.enum(["white", "muted", "brand", "ink"]).default("white"),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  featuredProduct: z.object({
    layout: z.enum(["split", "editorial", "poster"]).default("split"),
    productId: z.string().default(""),
    eyebrow: z.string().max(60).default("Featured"),
    heading: z.string().max(120).default(""),
    body: z.string().max(600).default(""),
    ctaLabel: z.string().max(40).default("View product"),
    imagePosition: z.enum(["left", "right"]).default("left"),
    ...base,
  }),

  collectionGrid: z.object({
    layout: z.enum(["cards", "mosaic", "list", "circles"]).default("cards"),
    heading: z.string().max(120).default("Shop by collection"),
    collectionSlugs: z.array(z.string()).default([]),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    background: z.enum(["white", "muted", "brand", "ink"]).default("white"),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  collectionHero: z.object({
    collectionSlug: z.string().max(120).default(""),
    layout: z.enum(["banner", "split", "text"]).default("banner"),
    headline: z.string().max(120).default(""),
    body: z.string().max(280).default(""),
    ctaLabel: z.string().max(40).default("Shop the collection"),
    media: mediaSchema.default(() => mediaSchema.parse({})),
    height: z.enum(HEIGHTS).default("medium"),
    ...base,
  }),

  text: z.object({
    layout: z.enum(["standard", "statement", "columns", "eyebrow"]).default("standard"),
    eyebrow: z.string().max(60).default(""),
    heading: z.string().max(140).default(""),
    body: z.string().max(3000).default(""),
    align: z.enum(["left", "center"]).default("left"),
    size: z.enum(["md", "lg", "xl"]).default("md"),
    background: z.enum(["white", "muted", "brand", "ink"]).default("white"),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  imageText: z.object({
    layout: z.enum(["split", "overlap", "stacked", "wideImage", "narrowImage"]).default("split"),
    eyebrow: z.string().max(60).default(""),
    heading: z.string().max(120).default(""),
    body: z.string().max(1200).default(""),
    ctaLabel: z.string().max(40).default(""),
    ctaHref: z.string().max(200).default(""),
    imageUrl: z.string().nullable().default(null),
    media: mediaSchema.default(() => mediaSchema.parse({})),
    imagePosition: z.enum(["left", "right"]).default("right"),
    imageRatio: z.enum(["inherit", "square", "portrait", "landscape", "tall", "wide"]).default("inherit"),
    background: z.enum(["white", "muted", "brand", "ink"]).default("white"),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  gallery: z.object({
    layout: z.enum(["grid", "mosaic", "masonry", "strip"]).default("grid"),
    heading: z.string().max(120).default(""),
    items: z.array(z.object({ media: mediaSchema.default(() => mediaSchema.parse({})), caption: z.string().max(120).default(""), href: z.string().max(200).default("") })).max(12).default([]),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    ratio: z.enum(["inherit", "square", "portrait", "landscape", "tall", "wide"]).default("inherit"),
    ...base,
  }),

  fullImage: z.object({
    media: mediaSchema.default(() => mediaSchema.parse({})),
    height: z.enum(HEIGHTS).default("medium"),
    caption: z.string().max(160).default(""),
    parallax: z.boolean().default(true),
    ...base,
  }),

  lookbook: z.object({
    layout: z.enum(["editorial", "filmstrip", "stacked"]).default("editorial"),
    heading: z.string().max(120).default(""),
    intro: z.string().max(300).default(""),
    items: z.array(z.object({
      media: mediaSchema.default(() => mediaSchema.parse({})),
      caption: z.string().max(140).default(""),
      productSlug: z.string().max(120).default(""),
      size: z.enum(["large", "medium", "small"]).default("large"),
    })).max(10).default([]),
    ...base,
  }),

  specSheet: z.object({
    layout: z.enum(["table", "cards", "compare"]).default("table"),
    heading: z.string().max(120).default(""),
    intro: z.string().max(300).default(""),
    rows: z.array(z.object({
      label: z.string().max(60),
      value: z.string().max(160).default(""),
      detail: z.string().max(240).default(""),
    })).max(12).default([]),
    /** Column headings for the compare layout; row values are split on "|". */
    columns: z.array(z.string().max(40)).max(3).default([]),
    ...base,
  }),

  dropCountdown: z.object({
    layout: z.enum(["banner", "poster"]).default("banner"),
    eyebrow: z.string().max(60).default("Next drop"),
    headline: z.string().max(140).default("The next drop is coming"),
    body: z.string().max(280).default(""),
    /** ISO date-time; empty means "no date yet". */
    endsAt: z.string().max(40).default(""),
    ctaLabel: z.string().max(40).default("Get notified"),
    ctaHref: z.string().max(200).default(""),
    showNewsletter: z.boolean().default(true),
    media: mediaSchema.default(() => mediaSchema.parse({})),
    ...base,
  }),

  stats: z.object({
    layout: z.enum(["row", "grid", "inline"]).default("row"),
    heading: z.string().max(120).default(""),
    items: z.array(z.object({ value: z.string().max(24), label: z.string().max(80) })).max(6).default([]),
    ...base,
  }),

  logoList: z.object({
    heading: z.string().max(120).default("As seen in"),
    items: z.array(z.object({ media: mediaSchema.default(() => mediaSchema.parse({})), name: z.string().max(60).default(""), href: z.string().max(200).default("") })).max(12).default([]),
    layout: z.enum(["row", "marquee", "grid"]).default("row"),
    ...base,
  }),

  quote: z.object({
    layout: z.enum(["large", "editorial", "card"]).default("large"),
    quote: z.string().max(400).default(""),
    author: z.string().max(80).default(""),
    role: z.string().max(80).default(""),
    media: mediaSchema.default(() => mediaSchema.parse({})),
    ...base,
  }),

  story: z.object({
    layout: z.enum(["timeline", "alternating", "steps"]).default("alternating"),
    heading: z.string().max(120).default(""),
    items: z.array(z.object({ title: z.string().max(80), body: z.string().max(400).default(""), media: mediaSchema.default(() => mediaSchema.parse({})) })).max(8).default([]),
    ...base,
  }),

  benefits: z.object({
    layout: z.enum(["rows", "columns", "cards", "icons"]).default("columns"),
    heading: z.string().max(120).default(""),
    items: z.array(z.object({ title: z.string().max(80), body: z.string().max(240).default(""), icon: z.string().max(24).default("") })).max(6).default([]),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    background: z.enum(["white", "muted", "brand", "ink"]).default("white"),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  testimonials: z.object({
    layout: z.enum(["grid", "single", "marquee", "editorial"]).default("grid"),
    heading: z.string().max(120).default("In their words"),
    items: z.array(z.object({ quote: z.string().max(400), author: z.string().max(80).default(""), role: z.string().max(80).default("") })).max(8).default([]),
    background: z.enum(["white", "muted", "brand", "ink"]).default("white"),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  reviews: z.object({
    heading: z.string().max(120).default("What customers say"),
    limit: z.number().int().min(1).max(12).default(3),
    minRating: z.number().int().min(1).max(5).default(4),
    layout: z.enum(["grid", "list"]).default("grid"),
    background: z.enum(["white", "muted", "brand", "ink"]).default("white"),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  faq: z.object({
    heading: z.string().max(120).default("Common questions"),
    layout: z.enum(["accordion", "twoColumn"]).default("accordion"),
    items: z.array(z.object({ q: z.string().max(200), a: z.string().max(1200) })).max(12).default([]),
    background: z.enum(["white", "muted", "brand", "ink"]).default("white"),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  newsletter: z.object({
    layout: z.enum(["centered", "inline", "split", "banner"]).default("centered"),
    heading: z.string().max(120).default("Stay in touch"),
    body: z.string().max(280).default(""),
    buttonLabel: z.string().max(40).default("Subscribe"),
    media: mediaSchema.default(() => mediaSchema.parse({})),
    background: z.enum(["white", "muted", "brand", "ink"]).default("white"),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  customBanner: z.object({
    layout: z.enum(["strip", "card", "poster"]).default("strip"),
    heading: z.string().max(120).default(""),
    body: z.string().max(400).default(""),
    ctaLabel: z.string().max(40).default(""),
    ctaHref: z.string().max(200).default(""),
    media: mediaSchema.default(() => mediaSchema.parse({})),
    background: z.enum(["white", "muted", "brand", "ink"]).default("white"),
    spacing: z.enum(["compact", "normal", "roomy"]).default("normal"),
    ...base,
  }),

  valueProps: z.object({
    layout: z.enum(["row", "grid"]).default("row"),
    items: z.array(z.object({ title: z.string().max(60), body: z.string().max(120).default(""), icon: z.enum(["truck", "undo", "shield", "leaf", "star", "clock", "lock", "gift", "heart", "sparkles", "check"]).default("truck") })).max(6)
      .default([{ title: "Free shipping", body: "On orders over $75", icon: "truck" }, { title: "Easy returns", body: "60 days, no questions", icon: "undo" }, { title: "Secure checkout", body: "Encrypted end to end", icon: "shield" }]),
    ...base,
  }),
} satisfies Record<SectionType, z.ZodType>;

export type SectionConfig<T extends SectionType> = z.infer<(typeof sectionSchemas)[T]>;

// ---------------------------------------------------------------------------
// Metadata for the editor, the AI and the composition engine
// ---------------------------------------------------------------------------
export type SectionCategory = "hero" | "product" | "content" | "conversion" | "brand";
export const SECTION_CATEGORIES: Array<{ id: SectionCategory; label: string }> = [
  { id: "hero", label: "Hero & brand" }, { id: "product", label: "Products" }, { id: "content", label: "Content" },
  { id: "conversion", label: "Conversion" }, { id: "brand", label: "Story & proof" },
];

export type SectionMeta = {
  label: string; description: string; category: SectionCategory;
  /** Named compositions, when the section has more than one. */
  layouts?: Array<{ id: string; label: string }>;
  /** The key holding repeatable typed items ("blocks"), if any. */
  blocksKey?: string;
  blockLabel?: string;
  /** The `layout` values that fill their own data and shouldn't be hidden when empty in preview. */
  keywords?: string;
  /** Only available with a premium theme. */
  premium?: boolean;
};

export const SECTION_META: Record<SectionType, SectionMeta> = {
  announcement: { label: "Announcement bar", description: "Thin bar across the top of the page.", category: "hero", layouts: [{ id: "static", label: "Static" }, { id: "marquee", label: "Scrolling" }] },
  hero: { label: "Hero", description: "Headline, supporting line and calls to action, with seven compositions.", category: "hero",
    layouts: [{ id: "left", label: "Left aligned" }, { id: "center", label: "Centered" }, { id: "split", label: "Split (copy + image)" }, { id: "fullBleed", label: "Full-bleed image" }, { id: "editorial", label: "Editorial" }, { id: "minimal", label: "Minimal text" }, { id: "asymmetric", label: "Asymmetric" }], keywords: "banner headline" },
  imageHero: { label: "Image hero", description: "Full-bleed image with overlaid copy and optional parallax.", category: "hero",
    layouts: [{ id: "overlay", label: "Overlay" }, { id: "bottomLeft", label: "Bottom left" }, { id: "centered", label: "Centered" }, { id: "editorial", label: "Editorial caption" }] },
  videoHero: { label: "Video hero", description: "Muted looping video behind your headline; falls back to the poster under reduced motion.", category: "hero" },
  marquee: { label: "Scrolling text", description: "A continuous ticker of short phrases — energy without clutter.", category: "hero", blocksKey: "items", blockLabel: "Phrase" },
  featuredProducts: { label: "Featured products", description: "Products from a collection or rule, in five compositions.", category: "product",
    layouts: [{ id: "grid", label: "Grid" }, { id: "carousel", label: "Carousel" }, { id: "asymmetric", label: "Asymmetric" }, { id: "editorial", label: "Editorial (one large)" }, { id: "list", label: "List" }] },
  productGrid: { label: "Product grid", description: "A larger grid of products.", category: "product" },
  featuredProduct: { label: "Featured product", description: "One product, large — the hero of a launch.", category: "product",
    layouts: [{ id: "split", label: "Split" }, { id: "editorial", label: "Editorial" }, { id: "poster", label: "Poster" }] },
  collectionGrid: { label: "Collection grid", description: "Cards linking to collections.", category: "product",
    layouts: [{ id: "cards", label: "Cards" }, { id: "mosaic", label: "Mosaic" }, { id: "list", label: "List" }, { id: "circles", label: "Circles" }] },
  collectionHero: { label: "Collection hero", description: "Introduce one collection with imagery and a link.", category: "product",
    layouts: [{ id: "banner", label: "Banner" }, { id: "split", label: "Split" }, { id: "text", label: "Text only" }] },
  text: { label: "Text", description: "A heading and paragraph — or a big statement.", category: "content",
    layouts: [{ id: "standard", label: "Standard" }, { id: "statement", label: "Statement" }, { id: "columns", label: "Two columns" }, { id: "eyebrow", label: "Eyebrow + heading" }] },
  imageText: { label: "Image + text", description: "Side-by-side image and copy, five ways.", category: "content",
    layouts: [{ id: "split", label: "Split" }, { id: "overlap", label: "Overlap" }, { id: "stacked", label: "Stacked" }, { id: "wideImage", label: "Wide image" }, { id: "narrowImage", label: "Narrow image" }] },
  gallery: { label: "Gallery", description: "A set of images in a grid, mosaic, masonry or strip.", category: "content", blocksKey: "items", blockLabel: "Image",
    layouts: [{ id: "grid", label: "Grid" }, { id: "mosaic", label: "Mosaic" }, { id: "masonry", label: "Masonry" }, { id: "strip", label: "Strip" }] },
  fullImage: { label: "Full-width image", description: "One campaign image, edge to edge.", category: "content" },
  stats: { label: "Stats", description: "A few numbers that matter. Enter real ones.", category: "brand", blocksKey: "items", blockLabel: "Stat",
    layouts: [{ id: "row", label: "Row" }, { id: "grid", label: "Grid" }, { id: "inline", label: "Inline" }] },
  logoList: { label: "Logo list", description: "Press, partners or stockists.", category: "brand", blocksKey: "items", blockLabel: "Logo",
    layouts: [{ id: "row", label: "Row" }, { id: "marquee", label: "Scrolling" }, { id: "grid", label: "Grid" }] },
  quote: { label: "Quote", description: "One voice, large. A founder or a customer.", category: "brand",
    layouts: [{ id: "large", label: "Large" }, { id: "editorial", label: "Editorial" }, { id: "card", label: "Card" }] },
  story: { label: "Story", description: "Timeline, alternating chapters or numbered steps.", category: "brand", blocksKey: "items", blockLabel: "Chapter",
    layouts: [{ id: "timeline", label: "Timeline" }, { id: "alternating", label: "Alternating" }, { id: "steps", label: "Steps" }] },
  benefits: { label: "Benefits", description: "Three to six short value propositions.", category: "content", blocksKey: "items", blockLabel: "Benefit",
    layouts: [{ id: "rows", label: "Rows" }, { id: "columns", label: "Columns" }, { id: "cards", label: "Cards" }, { id: "icons", label: "Icons" }] },
  testimonials: { label: "Testimonials", description: "Quotes you enter yourself.", category: "brand", blocksKey: "items", blockLabel: "Testimonial",
    layouts: [{ id: "grid", label: "Grid" }, { id: "single", label: "Single large" }, { id: "marquee", label: "Scrolling" }, { id: "editorial", label: "Editorial" }] },
  reviews: { label: "Reviews", description: "Pulls real published product reviews.", category: "brand", layouts: [{ id: "grid", label: "Grid" }, { id: "list", label: "List" }] },
  faq: { label: "FAQ", description: "Expandable question and answer list.", category: "content", blocksKey: "items", blockLabel: "Question",
    layouts: [{ id: "accordion", label: "Accordion" }, { id: "twoColumn", label: "Two columns" }] },
  lookbook: { label: "Lookbook", description: "Editorial image sequence with captions and shop-the-look links — art direction, not a grid.", category: "brand", blocksKey: "items", blockLabel: "Look", premium: true,
    layouts: [{ id: "editorial", label: "Editorial (mixed sizes)" }, { id: "filmstrip", label: "Filmstrip (scrolls)" }, { id: "stacked", label: "Stacked full-width" }], keywords: "campaign editorial gallery shop the look" },
  specSheet: { label: "Spec sheet", description: "Structured details — materials, ingredients, dimensions, or a side-by-side comparison.", category: "content", blocksKey: "rows", blockLabel: "Row", premium: true,
    layouts: [{ id: "table", label: "Table" }, { id: "cards", label: "Cards" }, { id: "compare", label: "Compare columns" }], keywords: "ingredients materials specifications compare details" },
  dropCountdown: { label: "Drop countdown", description: "A timed launch with a live countdown and notify-me capture.", category: "conversion", premium: true,
    layouts: [{ id: "banner", label: "Banner" }, { id: "poster", label: "Poster (image)" }], keywords: "launch timer countdown release" },
  newsletter: { label: "Newsletter", description: "Email capture that creates real subscribers.", category: "conversion",
    layouts: [{ id: "centered", label: "Centered" }, { id: "inline", label: "Inline" }, { id: "split", label: "Split with image" }, { id: "banner", label: "Banner" }] },
  customBanner: { label: "Banner / CTA", description: "A promotional strip, card or poster with a call to action.", category: "conversion",
    layouts: [{ id: "strip", label: "Strip" }, { id: "card", label: "Card" }, { id: "poster", label: "Poster" }] },
  valueProps: { label: "Value props", description: "Shipping, returns and trust, in a row.", category: "conversion", blocksKey: "items", blockLabel: "Item",
    layouts: [{ id: "row", label: "Row" }, { id: "grid", label: "Grid" }] },
};

export function isSectionType(value: string): value is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(value);
}

/**
 * Validates and fills defaults. Unknown keys are dropped rather than stored.
 * A single bad field never discards the whole section: nulls mean "not set"
 * so the default applies, invalid keys are removed one by one, then parsed.
 * v1 `background`/`spacing` are mirrored into `design` so old configs render
 * identically through the new shell.
 */
export function normaliseSectionConfig(type: string, config: unknown): Record<string, unknown> {
  if (!isSectionType(type)) return {};
  const schema = sectionSchemas[type];
  const input = migrateV1(type, stripNullish(config));

  const result = schema.safeParse(input);
  if (result.success) return result.data as Record<string, unknown>;

  const invalidKeys = new Set(result.error.issues.map((issue) => String(issue.path[0])));
  const filtered = Object.fromEntries(Object.entries(input).filter(([key]) => !invalidKeys.has(key)));
  const retry = schema.safeParse(filtered);
  return (retry.success ? retry.data : schema.parse({})) as Record<string, unknown>;
}

const V1_SCHEME: Record<string, SectionDesign["scheme"]> = { white: "base", muted: "muted", brand: "accent", ink: "contrast" };
const V1_PAD: Record<string, SectionDesign["paddingTop"]> = { compact: "sm", normal: "md", roomy: "lg" };

function migrateV1(type: SectionType, input: Record<string, unknown>): Record<string, unknown> {
  const design = (input.design && typeof input.design === "object" ? { ...(input.design as Record<string, unknown>) } : {}) as Record<string, unknown>;
  if (!("scheme" in design) && typeof input.background === "string" && V1_SCHEME[input.background]) design.scheme = V1_SCHEME[input.background];
  if (!("paddingTop" in design) && typeof input.spacing === "string" && V1_PAD[input.spacing]) { design.paddingTop = V1_PAD[input.spacing]; design.paddingBottom = V1_PAD[input.spacing]; }
  if (!("align" in design) && (type === "hero" || type === "text") && input.align === "center") design.align = "center";
  // Legacy imageUrl → media.url when no media object is present.
  if (typeof input.imageUrl === "string" && input.imageUrl && !(input.media && typeof input.media === "object" && (input.media as Record<string, unknown>).url)) {
    input.media = { ...((input.media as Record<string, unknown>) ?? {}), url: input.imageUrl };
  }
  return { ...input, design };
}

function stripNullish(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== "object") return {};
  return Object.fromEntries(Object.entries(config as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined));
}

export function defaultSectionConfig(type: SectionType): Record<string, unknown> {
  return sectionSchemas[type].parse({}) as Record<string, unknown>;
}

/**
 * DNA-aware defaults: a section added to a luxury store arrives looking
 * luxury — composition, padding, motion and image treatment follow the
 * store's character, so nothing "suddenly looks like generic Halyard".
 */
export function sectionDefaultsFor(type: SectionType, theme: Pick<ResolvedTheme, "dna" | "direction" | "motion" | "cards">): Record<string, unknown> {
  const base = defaultSectionConfig(type);
  const { dna } = theme;
  const pad = dna.density <= 33 ? "lg" : dna.density >= 66 ? "sm" : "md";
  const design = { ...(base.design as SectionDesign), paddingTop: pad, paddingBottom: pad };
  const patch: Record<string, unknown> = { design };
  switch (type) {
    case "hero":
      patch.layout = dna.expression >= 80 ? "asymmetric" : dna.expression >= 60 ? "fullBleed" : dna.era <= 35 ? "editorial" : dna.density <= 25 ? "minimal" : dna.tone >= 60 ? "center" : "left";
      patch.headingSize = dna.expression >= 75 ? "display" : dna.expression >= 50 ? "xl" : "lg";
      patch.height = dna.expression >= 70 ? "screen" : "large";
      break;
    case "featuredProducts":
      patch.layout = dna.expression >= 75 ? "asymmetric" : dna.era <= 35 && dna.density <= 40 ? "editorial" : dna.energy >= 65 ? "carousel" : "grid";
      patch.columns = dna.density >= 66 ? 4 : dna.density <= 30 ? 3 : 4;
      break;
    case "imageText":
      patch.layout = dna.expression >= 70 ? "overlap" : dna.density <= 30 ? "wideImage" : "split";
      break;
    case "testimonials":
      patch.layout = dna.density <= 30 ? "single" : dna.energy >= 70 ? "marquee" : dna.era <= 35 ? "editorial" : "grid";
      break;
    case "benefits":
      patch.layout = dna.tone >= 60 ? "cards" : dna.geometry >= 70 ? "columns" : dna.density <= 30 ? "rows" : "icons";
      break;
    case "collectionGrid":
      patch.layout = dna.expression >= 70 ? "mosaic" : dna.tone >= 70 ? "circles" : "cards";
      break;
    case "newsletter":
      patch.layout = dna.density <= 30 ? "banner" : dna.expression >= 60 ? "split" : "centered";
      break;
    case "text":
      patch.layout = dna.expression >= 70 ? "statement" : dna.era <= 35 ? "eyebrow" : "standard";
      break;
    case "customBanner":
      patch.layout = dna.expression >= 70 ? "poster" : dna.tone >= 60 ? "card" : "strip";
      break;
  }
  return { ...base, ...patch };
}

/** A short human summary shown in the editor's section list. */
export function summariseSection(type: string, config: Record<string, unknown>): string {
  const value = (key: string) => (typeof config[key] === "string" ? (config[key] as string) : "");
  switch (type) {
    case "hero": case "imageHero": case "videoHero": case "collectionHero": case "dropCountdown":
      return value("headline") || "No headline";
    case "announcement": return value("text");
    case "marquee": return (Array.isArray(config.items) ? (config.items as Array<{ text: string }>).map((i) => i.text).join(" · ") : "") || "Scrolling text";
    case "quote": return value("quote").slice(0, 60) || "Quote";
    case "fullImage": return value("caption") || "Full-width image";
    case "valueProps": return "Shipping, returns, trust";
    case "featuredProduct": return value("heading") || "Featured product";
    default:
      return value("heading") || SECTION_META[type as SectionType]?.description || "";
  }
}
