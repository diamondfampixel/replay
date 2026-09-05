import { HEIGHTS, SECTION_ALIGNS, SECTION_MOTIONS, SECTION_PADS, SECTION_REVEALS, SECTION_WIDTHS, type SectionType } from "@/lib/storefront/sections";

/**
 * Declarative editing specs for every section type. The editor renders forms
 * from these, and the AI's tool descriptions are derived from the same list,
 * so a new field is one entry here — not a new form and a new prompt.
 */
export type Option = { value: string | number; label: string };
export type FieldSpec =
  | { key: string; label: string; type: "text" | "textarea" | "url" | "number" | "boolean"; hint?: string; advanced?: boolean; group?: "content" | "layout"; min?: number; max?: number; rows?: number; showIf?: (config: Record<string, unknown>) => boolean }
  | { key: string; label: string; type: "select"; options: Option[]; hint?: string; advanced?: boolean; group?: "content" | "layout"; showIf?: (config: Record<string, unknown>) => boolean }
  | { key: string; label: string; type: "media"; hint?: string; advanced?: boolean; group?: "content" | "layout"; showIf?: (config: Record<string, unknown>) => boolean }
  | { key: string; label: string; type: "product" | "collection" | "collections" | "products"; hint?: string; advanced?: boolean; group?: "content" | "layout"; showIf?: (config: Record<string, unknown>) => boolean }
  | { key: string; label: string; type: "items"; itemLabel: string; fields: FieldSpec[]; max?: number; hint?: string; advanced?: boolean; group?: "content" | "layout"; showIf?: (config: Record<string, unknown>) => boolean };

const opts = (values: readonly (string | number)[], labels?: Record<string, string>): Option[] =>
  values.map((v) => ({ value: v, label: labels?.[String(v)] ?? String(v).replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) }));

const ICON_OPTIONS: Option[] = ["truck", "undo", "shield", "leaf", "star", "clock", "lock", "gift", "heart", "sparkles", "check"].map((v) => ({ value: v, label: v }));
const RATIO_OPTIONS: Option[] = opts(["inherit", "square", "portrait", "landscape", "tall", "wide"], { inherit: "Store default" });
const HEIGHT_OPTIONS: Option[] = opts(HEIGHTS, { auto: "Auto", small: "Small", medium: "Medium", large: "Large", screen: "Full screen" });
const cta = (labelKey = "ctaLabel", hrefKey = "ctaHref", label = "Button"): FieldSpec[] => [
  { key: labelKey, label: `${label} label`, type: "text" },
  { key: hrefKey, label: `${label} link`, type: "url", hint: "e.g. /shop or /collections/new" },
];
const heading: FieldSpec = { key: "heading", label: "Heading", type: "text" };
const mediaField = (label = "Image"): FieldSpec => ({ key: "media", label, type: "media" });
const columns = (values: number[]): FieldSpec => ({ key: "columns", label: "Columns", type: "select", group: "layout", options: values.map((v) => ({ value: v, label: String(v) })) });
const mobileColumns: FieldSpec = { key: "mobileColumns", label: "Mobile columns", type: "select", group: "layout", options: [{ value: 1, label: "1" }, { value: 2, label: "2" }], advanced: true };

export const SECTION_FIELDS: Record<SectionType, FieldSpec[]> = {
  announcement: [
    { key: "text", label: "Message", type: "text" },
    { key: "link", label: "Link", type: "url" },
    { key: "background", label: "Colour", type: "select", group: "layout", options: [{ value: "ink", label: "Dark" }, { value: "brand", label: "Brand colour" }, { value: "muted", label: "Light" }] },
  ],
  hero: [
    { key: "eyebrow", label: "Eyebrow", type: "text", advanced: true },
    { key: "headline", label: "Headline", type: "textarea", rows: 2 },
    { key: "subheadline", label: "Subheadline", type: "textarea", rows: 2 },
    ...cta(),
    ...cta("secondaryCtaLabel", "secondaryCtaHref", "Second button"),
    mediaField(),
    { key: "headingSize", label: "Headline size", type: "select", group: "layout", options: opts(["md", "lg", "xl", "display"], { md: "Medium", lg: "Large", xl: "Extra large", display: "Display" }) },
    { key: "height", label: "Height", type: "select", group: "layout", options: HEIGHT_OPTIONS },
    { key: "align", label: "Text alignment", type: "select", group: "layout", options: opts(["left", "center"]), showIf: (c) => c.layout === "fullBleed" || c.layout === "left" },
  ],
  imageHero: [
    { key: "eyebrow", label: "Eyebrow", type: "text", advanced: true },
    { key: "headline", label: "Headline", type: "textarea", rows: 2 },
    { key: "subheadline", label: "Subheadline", type: "textarea", rows: 2 },
    ...cta(),
    mediaField("Background image"),
    { key: "overlay", label: "Darken image (%)", type: "number", min: 0, max: 90, group: "layout" },
    { key: "height", label: "Height", type: "select", group: "layout", options: HEIGHT_OPTIONS },
    { key: "align", label: "Text alignment", type: "select", group: "layout", options: opts(["left", "center"]), showIf: (c) => c.layout === "overlay" },
    { key: "parallax", label: "Parallax when the store's motion allows it", type: "boolean", group: "layout", advanced: true },
  ],
  videoHero: [
    { key: "videoUrl", label: "Video URL (mp4/webm)", type: "url", hint: "Muted, looping. Keep it under ~5 MB. The poster shows when motion is reduced." },
    { key: "posterUrl", label: "Poster image URL", type: "url" },
    { key: "eyebrow", label: "Eyebrow", type: "text", advanced: true },
    { key: "headline", label: "Headline", type: "textarea", rows: 2 },
    { key: "subheadline", label: "Subheadline", type: "textarea", rows: 2 },
    ...cta(),
    { key: "overlay", label: "Darken video (%)", type: "number", min: 0, max: 90, group: "layout" },
    { key: "height", label: "Height", type: "select", group: "layout", options: HEIGHT_OPTIONS },
    { key: "align", label: "Text alignment", type: "select", group: "layout", options: opts(["left", "center"]) },
  ],
  marquee: [
    { key: "items", label: "Phrases", type: "items", itemLabel: "Phrase", max: 12, fields: [{ key: "text", label: "Text", type: "text" }] },
    { key: "size", label: "Size", type: "select", group: "layout", options: opts(["sm", "md", "lg", "xl"], { sm: "Small", md: "Medium", lg: "Large", xl: "Huge" }) },
    { key: "separator", label: "Separator", type: "text", group: "layout", advanced: true },
    { key: "direction", label: "Direction", type: "select", group: "layout", options: opts(["left", "right"]), advanced: true },
  ],
  featuredProducts: [
    heading,
    { key: "subheading", label: "Subheading", type: "text" },
    { key: "source", label: "Products come from", type: "select", options: [{ value: "newest", label: "Newest products" }, { value: "bestsellers", label: "Best sellers" }, { value: "collection", label: "A collection" }, { value: "manual", label: "Chosen by hand" }] },
    { key: "collectionSlug", label: "Collection", type: "collection", showIf: (c) => c.source === "collection" },
    { key: "productIds", label: "Products", type: "products", showIf: (c) => c.source === "manual" },
    { key: "limit", label: "How many", type: "number", min: 2, max: 12 },
    ...cta("ctaLabel", "ctaHref", "\"View all\" link"),
    columns([2, 3, 4, 5]),
    mobileColumns,
  ],
  productGrid: [
    heading,
    { key: "limit", label: "How many", type: "number", min: 3, max: 48 },
    columns([2, 3, 4, 5]),
    mobileColumns,
  ],
  featuredProduct: [
    { key: "productId", label: "Product", type: "product" },
    { key: "eyebrow", label: "Eyebrow", type: "text" },
    { key: "heading", label: "Heading", type: "text", hint: "Leave empty to use the product's name" },
    { key: "body", label: "Body", type: "textarea", rows: 4, hint: "Leave empty to use the product description" },
    { key: "ctaLabel", label: "Button label", type: "text" },
    { key: "imagePosition", label: "Image side", type: "select", group: "layout", options: opts(["left", "right"]), showIf: (c) => c.layout === "split" },
  ],
  collectionGrid: [
    heading,
    { key: "collectionSlugs", label: "Collections shown", type: "collections", hint: "Leave all unchecked to show your first six collections." },
    columns([2, 3, 4]),
  ],
  collectionHero: [
    { key: "collectionSlug", label: "Collection", type: "collection" },
    { key: "headline", label: "Headline", type: "text", hint: "Leave empty to use the collection's name" },
    { key: "body", label: "Body", type: "textarea", rows: 3 },
    { key: "ctaLabel", label: "Button label", type: "text" },
    mediaField("Image (overrides the collection image)"),
    { key: "height", label: "Height", type: "select", group: "layout", options: HEIGHT_OPTIONS, showIf: (c) => c.layout === "banner" },
  ],
  text: [
    { key: "eyebrow", label: "Eyebrow", type: "text", advanced: true },
    heading,
    { key: "body", label: "Body", type: "textarea", rows: 6 },
    { key: "size", label: "Heading size", type: "select", group: "layout", options: opts(["md", "lg", "xl"], { md: "Medium", lg: "Large", xl: "Extra large" }) },
    { key: "align", label: "Alignment", type: "select", group: "layout", options: opts(["left", "center"]) },
  ],
  imageText: [
    { key: "eyebrow", label: "Eyebrow", type: "text", advanced: true },
    heading,
    { key: "body", label: "Body", type: "textarea", rows: 5 },
    ...cta(),
    mediaField(),
    { key: "imagePosition", label: "Image side", type: "select", group: "layout", options: opts(["left", "right"]) },
    { key: "imageRatio", label: "Image shape", type: "select", group: "layout", options: RATIO_OPTIONS, advanced: true },
  ],
  gallery: [
    heading,
    { key: "items", label: "Images", type: "items", itemLabel: "Image", max: 12, fields: [{ key: "media", label: "Image", type: "media" }, { key: "caption", label: "Caption", type: "text" }, { key: "href", label: "Link", type: "url" }] },
    columns([2, 3, 4]),
    { key: "ratio", label: "Image shape", type: "select", group: "layout", options: RATIO_OPTIONS },
  ],
  fullImage: [
    mediaField(),
    { key: "caption", label: "Caption", type: "text" },
    { key: "height", label: "Height", type: "select", group: "layout", options: HEIGHT_OPTIONS },
    { key: "parallax", label: "Parallax when the store's motion allows it", type: "boolean", group: "layout", advanced: true },
  ],
  stats: [
    heading,
    { key: "items", label: "Numbers", type: "items", itemLabel: "Stat", max: 6, hint: "Real figures only — never invent a number.", fields: [{ key: "value", label: "Value (e.g. 12k)", type: "text" }, { key: "label", label: "Label", type: "text" }] },
  ],
  logoList: [
    heading,
    { key: "items", label: "Logos", type: "items", itemLabel: "Logo", max: 12, fields: [{ key: "media", label: "Logo image", type: "media" }, { key: "name", label: "Name (shown when there is no image)", type: "text" }, { key: "href", label: "Link", type: "url" }] },
  ],
  quote: [
    { key: "quote", label: "Quote", type: "textarea", rows: 4 },
    { key: "author", label: "Name", type: "text" },
    { key: "role", label: "Role or location", type: "text" },
    mediaField("Portrait (editorial layout)"),
  ],
  lookbook: [
    heading,
    { key: "intro", label: "Intro", type: "textarea", rows: 2 },
    { key: "items", label: "Looks", type: "items", itemLabel: "Look", max: 10, fields: [
      { key: "media", label: "Image", type: "media" },
      { key: "caption", label: "Caption", type: "text" },
      { key: "productSlug", label: "Product slug (shop the look)", type: "text", hint: "The last part of the product URL, e.g. wool-beanie" },
      { key: "size", label: "Size", type: "select", options: [{ value: "large", label: "Large" }, { value: "medium", label: "Medium" }, { value: "small", label: "Small" }] },
    ] },
  ],
  specSheet: [
    heading,
    { key: "intro", label: "Intro", type: "textarea", rows: 2 },
    { key: "rows", label: "Rows", type: "items", itemLabel: "Row", max: 12, fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "value", label: "Value", type: "text", hint: "For the compare layout, separate columns with |" },
      { key: "detail", label: "Detail", type: "textarea", rows: 2 },
    ] },
    { key: "columns", label: "Compare columns", type: "items", itemLabel: "Column", max: 3, group: "layout", fields: [{ key: "", label: "Name", type: "text" }], showIf: (c) => c.layout === "compare" },
  ],
  dropCountdown: [
    { key: "eyebrow", label: "Eyebrow", type: "text" },
    { key: "headline", label: "Headline", type: "text" },
    { key: "body", label: "Body", type: "textarea", rows: 2 },
    { key: "endsAt", label: "Drop date & time", type: "text", hint: "ISO format, e.g. 2026-10-01T16:00:00Z. Leave empty for \"to be announced\"." },
    { key: "ctaLabel", label: "Button label", type: "text" },
    { key: "ctaHref", label: "Button link", type: "url", hint: "Leave empty to show only the notify-me form" },
    { key: "showNewsletter", label: "Show notify-me form", type: "boolean" },
    { key: "media", label: "Poster image", type: "media", showIf: (c) => c.layout === "poster" },
  ],
  story: [
    heading,
    { key: "items", label: "Chapters", type: "items", itemLabel: "Chapter", max: 8, fields: [{ key: "title", label: "Title", type: "text" }, { key: "body", label: "Body", type: "textarea", rows: 3 }, { key: "media", label: "Image", type: "media" }] },
  ],
  benefits: [
    heading,
    { key: "items", label: "Benefits", type: "items", itemLabel: "Benefit", max: 6, fields: [{ key: "title", label: "Title", type: "text" }, { key: "body", label: "Description", type: "textarea", rows: 2 }, { key: "icon", label: "Icon", type: "select", options: [{ value: "", label: "None" }, ...ICON_OPTIONS] }] },
    columns([2, 3, 4]),
  ],
  testimonials: [
    heading,
    { key: "items", label: "Testimonials", type: "items", itemLabel: "Testimonial", max: 8, hint: "Only quotes real customers actually gave you. This section stays hidden on the live store while empty.", fields: [{ key: "quote", label: "Quote", type: "textarea", rows: 3 }, { key: "author", label: "Name", type: "text" }, { key: "role", label: "Role or location", type: "text" }] },
  ],
  reviews: [
    heading,
    { key: "limit", label: "How many", type: "number", min: 1, max: 12 },
    { key: "minRating", label: "Minimum rating", type: "select", options: [5, 4, 3, 2, 1].map((r) => ({ value: r, label: `${r} stars and up` })), hint: "Pulls real published reviews from your catalog. Nothing is invented." },
  ],
  faq: [
    heading,
    { key: "items", label: "Questions", type: "items", itemLabel: "Question", max: 12, fields: [{ key: "q", label: "Question", type: "text" }, { key: "a", label: "Answer", type: "textarea", rows: 3 }] },
  ],
  newsletter: [
    heading,
    { key: "body", label: "Body", type: "textarea", rows: 2 },
    { key: "buttonLabel", label: "Button label", type: "text" },
    { key: "media", label: "Image (split layout)", type: "media", showIf: (c) => c.layout === "split" },
  ],
  customBanner: [
    heading,
    { key: "body", label: "Body", type: "textarea", rows: 3 },
    ...cta(),
    { key: "media", label: "Image (card and poster layouts)", type: "media", showIf: (c) => c.layout !== "strip" },
  ],
  valueProps: [
    { key: "items", label: "Items", type: "items", itemLabel: "Item", max: 6, hint: "Only promise what you actually offer.", fields: [{ key: "title", label: "Title", type: "text" }, { key: "body", label: "Detail", type: "text" }, { key: "icon", label: "Icon", type: "select", options: ICON_OPTIONS }] },
  ],
};

/** The shared per-section design controls (edit `config.design`). */
export const DESIGN_FIELDS: FieldSpec[] = [
  { key: "scheme", label: "Colour scheme", type: "select", options: [{ value: "base", label: "Page background" }, { value: "muted", label: "Muted band" }, { value: "accent", label: "Brand colour" }, { value: "contrast", label: "Contrast (dark/light flip)" }, { value: "custom", label: "Custom scheme…" }] },
  { key: "width", label: "Content width", type: "select", options: opts(SECTION_WIDTHS, { narrow: "Narrow", contained: "Standard", wide: "Wide", full: "Full bleed" }) },
  { key: "paddingTop", label: "Space above", type: "select", options: opts(SECTION_PADS, { none: "None", sm: "Small", md: "Medium", lg: "Large", xl: "Extra large" }) },
  { key: "paddingBottom", label: "Space below", type: "select", options: opts(SECTION_PADS, { none: "None", sm: "Small", md: "Medium", lg: "Large", xl: "Extra large" }) },
  { key: "align", label: "Alignment", type: "select", options: opts(SECTION_ALIGNS) },
  { key: "border", label: "Divider lines", type: "select", options: opts(["none", "top", "bottom", "both"]), advanced: true },
  { key: "motion", label: "Motion for this section", type: "select", options: opts(SECTION_MOTIONS, { inherit: "Store setting" }), advanced: true },
  { key: "reveal", label: "Scroll reveal", type: "select", options: opts(SECTION_REVEALS, { inherit: "Store setting", none: "None" }), advanced: true },
  { key: "mobileAlign", label: "Alignment on phones", type: "select", options: opts(["inherit", "left", "center"], { inherit: "Same as desktop" }), advanced: true },
  { key: "mobileHide", label: "Hide on phones", type: "boolean", advanced: true },
];

/** Compact, model-readable description of a section's editable keys. */
export function describeSectionFields(type: SectionType): string {
  return SECTION_FIELDS[type]
    .map((f) => (f.type === "select" ? `${f.key}: ${f.options.map((o) => JSON.stringify(o.value)).join("|")}` : f.type === "items" ? `${f.key}: [{ ${f.fields.map((x) => x.key).join(", ")} }]` : f.type === "media" ? `${f.key}: { url, alt, focalX, focalY, overlay }` : `${f.key}: ${f.type}`))
    .join(", ");
}
