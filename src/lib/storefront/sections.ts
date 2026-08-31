import { z } from "zod";

/**
 * The section contract.
 *
 * A storefront page is an ordered list of sections; each section is a type plus
 * a JSON config. The renderer, the visual editor and the AI all read and write
 * exactly this shape — the model never emits React source.
 */

export const SECTION_TYPES = [
  "announcement",
  "hero",
  "imageHero",
  "featuredProducts",
  "productGrid",
  "collectionGrid",
  "text",
  "imageText",
  "benefits",
  "testimonials",
  "reviews",
  "faq",
  "newsletter",
  "customBanner",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

const alignment = z.enum(["left", "center"]).default("left");
const background = z.enum(["white", "muted", "brand", "ink"]).default("white");
const spacing = z.enum(["compact", "normal", "roomy"]).default("normal");

export const sectionSchemas = {
  announcement: z.object({
    text: z.string().max(160).default("Free shipping on orders over $75"),
    link: z.string().max(200).default("/shop"),
    background: z.enum(["ink", "brand", "muted"]).default("ink"),
  }),
  hero: z.object({
    headline: z.string().max(120).default("A better everyday"),
    subheadline: z.string().max(280).default(""),
    ctaLabel: z.string().max(40).default("Shop now"),
    ctaHref: z.string().max(200).default("/shop"),
    secondaryCtaLabel: z.string().max(40).default(""),
    secondaryCtaHref: z.string().max(200).default(""),
    align: alignment,
    background,
    imageUrl: z.string().nullable().default(null),
    height: z.enum(["small", "medium", "large"]).default("large"),
    spacing,
  }),
  imageHero: z.object({
    headline: z.string().max(120).default(""),
    subheadline: z.string().max(280).default(""),
    ctaLabel: z.string().max(40).default("Shop now"),
    ctaHref: z.string().max(200).default("/shop"),
    imageUrl: z.string().nullable().default(null),
    overlay: z.number().min(0).max(80).default(30),
    align: z.enum(["left", "center"]).default("center"),
    spacing,
  }),
  featuredProducts: z.object({
    heading: z.string().max(120).default("Featured"),
    subheading: z.string().max(200).default(""),
    source: z.enum(["collection", "manual", "bestsellers", "newest"]).default("newest"),
    collectionSlug: z.string().max(120).default(""),
    productIds: z.array(z.string()).default([]),
    limit: z.number().int().min(2).max(12).default(4),
    layout: z.enum(["grid", "carousel"]).default("grid"),
    background,
    spacing,
  }),
  productGrid: z.object({
    heading: z.string().max(120).default("All products"),
    limit: z.number().int().min(3).max(48).default(12),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
    background,
    spacing,
  }),
  collectionGrid: z.object({
    heading: z.string().max(120).default("Shop by collection"),
    collectionSlugs: z.array(z.string()).default([]),
    background,
    spacing,
  }),
  text: z.object({
    heading: z.string().max(120).default(""),
    body: z.string().max(2000).default(""),
    align: alignment,
    background,
    spacing,
  }),
  imageText: z.object({
    heading: z.string().max(120).default(""),
    body: z.string().max(1200).default(""),
    ctaLabel: z.string().max(40).default(""),
    ctaHref: z.string().max(200).default(""),
    imageUrl: z.string().nullable().default(null),
    imagePosition: z.enum(["left", "right"]).default("right"),
    background,
    spacing,
  }),
  benefits: z.object({
    heading: z.string().max(120).default(""),
    items: z
      .array(z.object({ title: z.string().max(80), body: z.string().max(240).default("") }))
      .max(6)
      .default([]),
    background,
    spacing,
  }),
  testimonials: z.object({
    heading: z.string().max(120).default("In their words"),
    items: z
      .array(
        z.object({
          quote: z.string().max(400),
          author: z.string().max(80).default(""),
          role: z.string().max(80).default(""),
        }),
      )
      .max(6)
      .default([]),
    background,
    spacing,
  }),
  reviews: z.object({
    heading: z.string().max(120).default("What customers say"),
    limit: z.number().int().min(1).max(12).default(3),
    minRating: z.number().int().min(1).max(5).default(4),
    background,
    spacing,
  }),
  faq: z.object({
    heading: z.string().max(120).default("Common questions"),
    items: z.array(z.object({ q: z.string().max(200), a: z.string().max(1200) })).max(12).default([]),
    background,
    spacing,
  }),
  newsletter: z.object({
    heading: z.string().max(120).default("Stay in touch"),
    body: z.string().max(280).default(""),
    buttonLabel: z.string().max(40).default("Subscribe"),
    background,
    spacing,
  }),
  customBanner: z.object({
    heading: z.string().max(120).default(""),
    body: z.string().max(400).default(""),
    ctaLabel: z.string().max(40).default(""),
    ctaHref: z.string().max(200).default(""),
    background,
    spacing,
  }),
} satisfies Record<SectionType, z.ZodType>;

export type SectionConfig<T extends SectionType> = z.infer<(typeof sectionSchemas)[T]>;

export const SECTION_META: Record<
  SectionType,
  { label: string; description: string; group: "layout" | "commerce" | "content" | "capture" }
> = {
  announcement: { label: "Announcement bar", description: "Thin bar across the top of the page.", group: "layout" },
  hero: { label: "Hero", description: "Headline, supporting line and calls to action.", group: "layout" },
  imageHero: { label: "Image hero", description: "Full-bleed image with overlaid copy.", group: "layout" },
  featuredProducts: { label: "Featured products", description: "A row of products from a collection or rule.", group: "commerce" },
  productGrid: { label: "Product grid", description: "A larger grid of products.", group: "commerce" },
  collectionGrid: { label: "Collection grid", description: "Cards linking to collections.", group: "commerce" },
  text: { label: "Text", description: "A heading and paragraph.", group: "content" },
  imageText: { label: "Image + text", description: "Side-by-side image and copy.", group: "content" },
  benefits: { label: "Benefits", description: "Three to six short value propositions.", group: "content" },
  testimonials: { label: "Testimonials", description: "Quotes you enter yourself.", group: "content" },
  reviews: { label: "Reviews", description: "Pulls real published product reviews.", group: "content" },
  faq: { label: "FAQ", description: "Expandable question and answer list.", group: "content" },
  newsletter: { label: "Newsletter", description: "Email capture that creates real subscribers.", group: "capture" },
  customBanner: { label: "Banner", description: "A promotional strip with a call to action.", group: "capture" },
};

export function isSectionType(value: string): value is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(value);
}

/**
 * Validates and fills defaults. Unknown keys are dropped rather than stored.
 *
 * A single bad field must not discard the whole section — losing an entire
 * benefits list because its heading was null is worse than dropping the
 * heading. Nulls are treated as "not set" so the schema default applies, and
 * anything still invalid is removed key by key before a final parse.
 */
export function normaliseSectionConfig(type: string, config: unknown): Record<string, unknown> {
  if (!isSectionType(type)) return {};
  const schema = sectionSchemas[type];
  const input = stripNullish(config);

  const result = schema.safeParse(input);
  if (result.success) return result.data as Record<string, unknown>;

  const invalidKeys = new Set(result.error.issues.map((issue) => String(issue.path[0])));
  const filtered = Object.fromEntries(
    Object.entries(input).filter(([key]) => !invalidKeys.has(key)),
  );

  const retry = schema.safeParse(filtered);
  return (retry.success ? retry.data : schema.parse({})) as Record<string, unknown>;
}

/** Drops null and undefined so schema defaults apply instead of failing. */
function stripNullish(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== "object") return {};
  return Object.fromEntries(
    Object.entries(config as Record<string, unknown>).filter(
      ([, value]) => value !== null && value !== undefined,
    ),
  );
}

export function defaultSectionConfig(type: SectionType): Record<string, unknown> {
  return sectionSchemas[type].parse({}) as Record<string, unknown>;
}

/** A short human summary shown in the editor's section list. */
export function summariseSection(type: string, config: Record<string, unknown>): string {
  const value = (key: string) => (typeof config[key] === "string" ? (config[key] as string) : "");
  switch (type) {
    case "hero":
    case "imageHero":
      return value("headline") || "No headline";
    case "announcement":
      return value("text");
    case "featuredProducts":
    case "productGrid":
    case "collectionGrid":
    case "reviews":
    case "faq":
    case "newsletter":
    case "benefits":
    case "testimonials":
    case "customBanner":
    case "text":
    case "imageText":
      return value("heading") || SECTION_META[type as SectionType]?.description || "";
    default:
      return "";
  }
}
