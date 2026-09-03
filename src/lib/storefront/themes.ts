import type { StoreTheme } from "@/lib/storefront/theme";
import type { RecipeSlot } from "@/lib/storefront/compose";

/**
 * The Halyard theme library.
 *
 * A theme is a STARTING DESIGN, not a codebase: a structured theme (direction,
 * Design DNA, token groups, header/footer/product/collection layouts, motion)
 * plus a homepage recipe (sections, compositions, per-section design). Applying
 * one writes that configuration onto the store through the same paths the
 * editor and the AI use, so every theme stays fully customisable afterwards.
 *
 * Tiers: "included" is available on every plan, Free included. Premium tiers
 * are optional one-time purchases — a merchant can build a great store without
 * buying anything. Premium themes carry richer compositions, custom section
 * schemes, more deliberate motion and specialised product presentation; they
 * are never an included theme with a different background.
 *
 * Every theme is original Halyard composition built from Halyard primitives.
 * No imagery ships with a theme — previews render the merchant's own content.
 */
export type ThemeTier = "included" | "standard" | "premium" | "highend";
export const THEME_PRICES_CENTS: Record<ThemeTier, number> = { included: 0, standard: 500, premium: 1000, highend: 1500 };
export const THEME_CATEGORIES = [
  "fashion", "streetwear", "editorial", "minimal", "bold", "playful", "food", "beauty", "jewelry", "wellness", "sports",
  "creator", "technology", "gaming", "interior", "organic", "futuristic", "photography", "typography", "marketplace",
] as const;
export type ThemeCategory = (typeof THEME_CATEGORIES)[number];

export type CatalogTheme = {
  id: string;
  name: string;
  tier: ThemeTier;
  category: ThemeCategory;
  tags: ThemeCategory[];
  tagline: string;
  description: string;
  features: string[];
  /** The structured theme written to Store.theme on apply. */
  theme: StoreTheme;
  /** Homepage structure; content comes from the merchant's own store. */
  recipe: RecipeSlot[];
  /** Two or three swatch colours for the gallery card (derived from the theme). */
  swatch: [string, string, string];
};

const d = (scheme: string, extra: Record<string, unknown> = {}) => ({ scheme, ...extra });

// ---------------------------------------------------------------------------
// Included themes — available on every plan.
// ---------------------------------------------------------------------------
const INCLUDED: CatalogTheme[] = [
  {
    id: "northline", name: "Northline", tier: "included", category: "minimal", tags: ["minimal", "fashion", "interior"],
    tagline: "Clean grotesk, soft corners, nothing in the way.",
    description: "A calm contemporary default: split hero, four-up product grid, value props and a columns footer. The theme most stores can grow into without ever feeling generic.",
    features: ["Split hero with product image", "Value-prop strip", "Four-up grid", "Sticky classic header", "Subtle fade reveal"],
    theme: { direction: "modern", accent: "#0f6e5c", neutral: "cool", headerConfig: { style: "classic" }, footer: { style: "columns" }, product: { layout: "mediaLeft" }, motionConfig: { level: "subtle", reveal: "fade" } },
    recipe: [{ type: "announcement", layout: "static" }, { type: "hero", layout: "split" }, { type: "valueProps", layout: "row" }, { type: "featuredProducts", layout: "grid" }, { type: "imageText", layout: "split" }, { type: "collectionGrid", layout: "cards" }, { type: "reviews" }, { type: "faq", layout: "accordion" }, { type: "newsletter", layout: "centered" }],
    swatch: ["#fbfbfc", "#16181d", "#0f6e5c"],
  },
  {
    id: "ledger", name: "Ledger", tier: "included", category: "editorial", tags: ["editorial", "fashion", "interior"],
    tagline: "Serif display, generous whitespace, a magazine that sells.",
    description: "Editorial hero with copy set against the image, a statement paragraph, an editorial product grid with one large card, and a brand footer.",
    features: ["Editorial hero", "Statement text", "Editorial product grid", "Quote", "Brand footer", "Centered header"],
    theme: { direction: "editorial", accent: "#2b2622", neutral: "warm", headerConfig: { style: "centered" }, footer: { style: "brand" }, product: { layout: "stacked" }, layout: { density: "spacious" } },
    recipe: [{ type: "hero", layout: "editorial" }, { type: "text", layout: "statement", design: d("base", { width: "narrow" }) }, { type: "featuredProducts", layout: "editorial" }, { type: "imageText", layout: "wideImage" }, { type: "quote", layout: "editorial" }, { type: "collectionGrid", layout: "list" }, { type: "reviews", layout: "list" }, { type: "newsletter", layout: "centered" }],
    swatch: ["#faf8f4", "#241f1a", "#2b2622"],
  },
  {
    id: "blank-canvas", name: "Blank Canvas", tier: "included", category: "minimal", tags: ["minimal", "fashion", "photography"],
    tagline: "Maximum restraint. The product is the design.",
    description: "A minimal text hero, a three-column portrait grid, a single paragraph and an inline newsletter. Hairline detail, sharp corners, no decoration.",
    features: ["Minimal text hero", "Three-column portrait grid", "Hairline dividers", "Minimal header", "Inline newsletter"],
    theme: { direction: "minimal", accent: "#111111", neutral: "pure", headerConfig: { style: "minimal" }, footer: { style: "minimal" }, product: { layout: "minimal" }, cards: { ratio: "portrait", hover: "swap" } },
    recipe: [{ type: "hero", layout: "minimal", design: d("base", { paddingTop: "xl", paddingBottom: "lg" }) }, { type: "featuredProducts", layout: "grid", config: { columns: 3, limit: 6, heading: "" } }, { type: "text", layout: "eyebrow", design: d("base", { border: "top" }) }, { type: "collectionGrid", layout: "cards" }, { type: "newsletter", layout: "inline", design: d("base", { border: "top" }) }],
    swatch: ["#ffffff", "#111111", "#e5e5e5"],
  },
  {
    id: "blackout", name: "Blackout", tier: "included", category: "streetwear", tags: ["streetwear", "bold", "fashion"],
    tagline: "Heavy condensed type, high contrast, made for drops.",
    description: "Full-bleed hero, a scrolling marquee, an asymmetric product grid and a mosaic of collections on a dark ground. Uppercase everything.",
    features: ["Full-bleed hero", "Marquee", "Asymmetric product grid", "Collection mosaic", "Split header", "Expressive motion"],
    theme: { direction: "bold", accent: "#f2f2f0", neutral: "ink", headerConfig: { style: "split", navUppercase: true }, footer: { style: "brand", scheme: "base" }, product: { layout: "gallery" }, motionConfig: { level: "expressive", reveal: "slide" }, cards: { style: "overlay", ratio: "tall" } },
    recipe: [{ type: "announcement", layout: "marquee", config: { text: "New drop — limited run", background: "brand" }, always: true }, { type: "hero", layout: "fullBleed", config: { headingSize: "display", height: "screen" } }, { type: "marquee", layout: undefined, config: { items: [{ text: "Limited runs" }, { text: "No restocks" }, { text: "Ships worldwide" }], size: "lg" }, always: true }, { type: "featuredProducts", layout: "asymmetric", config: { limit: 6 } }, { type: "collectionGrid", layout: "mosaic" }, { type: "imageText", layout: "overlap" }, { type: "newsletter", layout: "banner" }],
    swatch: ["#0f1012", "#f2f1ee", "#2a2a2e"],
  },
  {
    id: "atelier", name: "Atelier", tier: "included", category: "fashion", tags: ["fashion", "editorial", "jewelry"],
    tagline: "High-contrast serif, wide letter-spacing, quiet luxury.",
    description: "A minimal hero on generous whitespace, an editorial product grid, a large quote and a list of collections. Uppercase serif headings with tall product imagery.",
    features: ["Minimal serif hero", "Editorial grid", "Large quote", "Collection list", "Centered header", "Immersive product page"],
    theme: { direction: "luxury", accent: "#1f1b17", neutral: "warm", headerConfig: { style: "centered", navUppercase: true, logoSize: "lg" }, footer: { style: "centered", scheme: "base" }, product: { layout: "immersive" } },
    recipe: [{ type: "hero", layout: "minimal", design: d("base", { paddingTop: "xl", paddingBottom: "xl" }) }, { type: "featuredProducts", layout: "editorial", config: { limit: 3, heading: "The edit" } }, { type: "text", layout: "statement", design: d("muted", { width: "narrow", paddingTop: "xl", paddingBottom: "xl" }) }, { type: "imageText", layout: "narrowImage" }, { type: "quote", layout: "large" }, { type: "collectionGrid", layout: "list" }, { type: "newsletter", layout: "centered" }],
    swatch: ["#faf8f4", "#1f1b17", "#b9a184"],
  },
  {
    id: "sherbet", name: "Sherbet", tier: "included", category: "playful", tags: ["playful", "food", "creator"],
    tagline: "Round type, pill buttons, colour everywhere it helps.",
    description: "Centered display hero, marquee, product carousel, benefit cards, circle collections and a split newsletter. Elevated cards that lift on hover.",
    features: ["Centered display hero", "Product carousel", "Benefit cards", "Circle collections", "Elevated cards", "Scale reveal"],
    theme: { direction: "playful", accent: "#ff3d8a", neutral: "pure", dna: { tone: 95, energy: 80 }, headerConfig: { style: "centered" }, footer: { style: "centered" }, product: { layout: "gallery" }, cards: { style: "elevated", hover: "lift", align: "center" }, motionConfig: { level: "expressive", reveal: "scale" } },
    recipe: [{ type: "announcement", layout: "static", config: { background: "brand" }, always: true }, { type: "hero", layout: "center", config: { headingSize: "display" }, design: d("muted") }, { type: "marquee", config: { items: [{ text: "New flavours" }, { text: "Gift boxes" }, { text: "Free sweets over $25" }], size: "md" }, always: true }, { type: "featuredProducts", layout: "carousel", config: { limit: 8 } }, { type: "benefits", layout: "cards", always: true }, { type: "collectionGrid", layout: "circles" }, { type: "faq", layout: "accordion" }, { type: "newsletter", layout: "split", design: d("accent") }],
    swatch: ["#ffffff", "#3a0a2a", "#ff3d8a"],
  },
  {
    id: "orchard", name: "Orchard", tier: "included", category: "food", tags: ["food", "organic", "marketplace"],
    tagline: "Warm, appetising and quick to shop.",
    description: "A split hero, a wide five-column product grid, collection cards and a benefits row on a warm sand ground. Built for catalogues with many small items.",
    features: ["Five-column grid", "Collection cards", "Benefits row", "Warm sand neutrals", "Rounded imagery", "Filters on"],
    theme: { direction: "organic", accent: "#b4471f", neutral: "sand", dna: { density: 70, tone: 55 }, headerConfig: { style: "classic" }, footer: { style: "columns" }, collection: { columns: 5, showFilters: true }, shape: { radius: "lg" }, cards: { ratio: "square" } },
    recipe: [{ type: "announcement", layout: "static" }, { type: "hero", layout: "split", design: d("accent") }, { type: "collectionGrid", layout: "cards", config: { columns: 4 } }, { type: "featuredProducts", layout: "grid", config: { columns: 5, limit: 10, heading: "Fresh this week" } }, { type: "benefits", layout: "icons", always: true }, { type: "imageText", layout: "split" }, { type: "reviews" }, { type: "newsletter", layout: "inline", design: d("muted") }],
    swatch: ["#f7f2ea", "#2a231b", "#b4471f"],
  },
  {
    id: "dermis", name: "Dermis", tier: "included", category: "beauty", tags: ["beauty", "wellness", "minimal"],
    tagline: "Clinical calm for skincare and beauty.",
    description: "Split hero, an eyebrow intro, portrait product grid, rows of benefits and a stacked story section. Warm paper, soft radius, subtle motion.",
    features: ["Portrait product grid", "Benefit rows", "Eyebrow intro", "Stacked story", "Soft radius", "Sticky-info product page"],
    theme: { direction: "organic", accent: "#8a6a4e", neutral: "warm", dna: { expression: 30, density: 30 }, typography: { display: "fraunces", body: "jost" }, headerConfig: { style: "centered" }, footer: { style: "brand", scheme: "muted" }, product: { layout: "stickyInfo" }, cards: { ratio: "portrait", hover: "swap" }, shape: { radius: "md" } },
    recipe: [{ type: "hero", layout: "split" }, { type: "text", layout: "eyebrow", design: d("base", { width: "narrow" }) }, { type: "featuredProducts", layout: "grid", config: { columns: 3, limit: 6 } }, { type: "benefits", layout: "rows", always: true }, { type: "imageText", layout: "stacked", design: d("muted") }, { type: "reviews" }, { type: "newsletter", layout: "centered" }],
    swatch: ["#faf8f4", "#2a231b", "#8a6a4e"],
  },
  {
    id: "carat", name: "Carat", tier: "included", category: "jewelry", tags: ["jewelry", "fashion", "minimal"],
    tagline: "Tall imagery, quiet type, room to look.",
    description: "A minimal hero, a three-column tall product grid on a pure ground, a centered statement and a circle collection row. Uppercase small headings, hairline borders.",
    features: ["Tall product imagery", "Circle collections", "Statement text", "Hairline framing", "Transparent header", "Stacked product page"],
    theme: { direction: "luxury", accent: "#111111", neutral: "pure", dna: { expression: 30, era: 40 }, typography: { display: "cormorant", body: "manrope", headingTransform: "uppercase" }, headerConfig: { style: "transparent", navUppercase: true }, footer: { style: "minimal" }, product: { layout: "stacked", imageRatio: "tall" }, cards: { ratio: "tall", hover: "zoom" }, surface: { borderWidth: 1 } },
    recipe: [{ type: "hero", layout: "center", design: d("muted", { paddingTop: "xl", paddingBottom: "xl" }) }, { type: "featuredProducts", layout: "grid", config: { columns: 3, limit: 6 } }, { type: "text", layout: "statement", design: d("base", { align: "center", width: "narrow" }) }, { type: "collectionGrid", layout: "circles" }, { type: "imageText", layout: "narrowImage" }, { type: "newsletter", layout: "centered", design: d("muted") }],
    swatch: ["#ffffff", "#111111", "#c9c2b6"],
  },
  {
    id: "stillwater", name: "Stillwater", tier: "included", category: "wellness", tags: ["wellness", "organic", "beauty"],
    tagline: "Unhurried, soft and honest.",
    description: "Split hero with soft pill buttons, a story in alternating chapters, a portrait grid and benefit rows. Sand neutrals, XL radius, no parallax.",
    features: ["Alternating story", "Benefit rows", "Soft pill buttons", "XL radius", "Brand footer", "Fade reveal"],
    theme: { direction: "organic", accent: "#5b7a3a", neutral: "sand", dna: { geometry: 5, edge: 10 }, shape: { radius: "xl" }, buttons: { style: "soft", shape: "pill" }, headerConfig: { style: "classic" }, footer: { style: "brand" }, product: { layout: "mediaLeft" }, motionConfig: { level: "subtle", parallax: false } },
    recipe: [{ type: "hero", layout: "split" }, { type: "text", layout: "eyebrow" }, { type: "featuredProducts", layout: "grid", config: { columns: 3, limit: 6 } }, { type: "story", layout: "alternating", always: true }, { type: "benefits", layout: "rows", always: true }, { type: "reviews" }, { type: "newsletter", layout: "centered", design: d("muted") }],
    swatch: ["#f7f2ea", "#2b2a22", "#5b7a3a"],
  },
  {
    id: "sprint", name: "Sprint", tier: "included", category: "sports", tags: ["sports", "bold", "streetwear"],
    tagline: "Fast, loud, built around numbers.",
    description: "Full-bleed hero, value props, an asymmetric grid, a stats row and a banner newsletter on a slate ground. Uppercase headings, lift hover, slide reveal.",
    features: ["Full-bleed hero", "Stats row", "Asymmetric grid", "Value props", "Split header", "Banner newsletter"],
    theme: { direction: "bold", accent: "#e8412c", neutral: "slate", dna: { energy: 85 }, headerConfig: { style: "split", navUppercase: true }, footer: { style: "columns" }, product: { layout: "gallery" }, cards: { style: "framed", hover: "lift" }, motionConfig: { level: "expressive", reveal: "slide" } },
    recipe: [{ type: "hero", layout: "fullBleed", config: { headingSize: "display" } }, { type: "valueProps", layout: "row", always: true }, { type: "featuredProducts", layout: "asymmetric", config: { limit: 6 } }, { type: "stats", layout: "row", always: true }, { type: "imageText", layout: "overlap" }, { type: "collectionGrid", layout: "mosaic" }, { type: "newsletter", layout: "banner", design: d("accent") }],
    swatch: ["#f7f8fa", "#12151b", "#e8412c"],
  },
  {
    id: "studio-vale", name: "Studio Vale", tier: "included", category: "creator", tags: ["creator", "photography", "typography"],
    tagline: "Oversized type and a personal voice.",
    description: "Asymmetric hero, marquee, asymmetric product grid, numbered steps, circle collections and an editorial quote on an ink ground. Blur reveal, fast marquee.",
    features: ["Asymmetric hero", "Numbered steps", "Editorial quote", "Overlay cards", "Transparent header", "Blur reveal"],
    theme: { direction: "creator", accent: "#ff5c1a", neutral: "ink", typography: { headingScale: 1.2 }, headerConfig: { style: "transparent", logoSize: "lg" }, footer: { style: "minimal" }, product: { layout: "gallery" }, cards: { style: "overlay", ratio: "portrait" }, motionConfig: { level: "expressive", reveal: "blur", marqueeSpeed: "fast" } },
    recipe: [{ type: "hero", layout: "asymmetric", config: { headingSize: "display" } }, { type: "marquee", config: { items: [{ text: "New season" }, { text: "Limited prints" }, { text: "One drop at a time" }], size: "lg" }, always: true }, { type: "featuredProducts", layout: "asymmetric", config: { limit: 6, heading: "The drop" } }, { type: "story", layout: "steps", always: true }, { type: "collectionGrid", layout: "circles" }, { type: "quote", layout: "editorial" }, { type: "newsletter", layout: "banner" }],
    swatch: ["#0f1012", "#f2f1ee", "#ff5c1a"],
  },
  {
    id: "circuit", name: "Circuit", tier: "included", category: "technology", tags: ["technology", "gaming", "minimal"],
    tagline: "Grotesk plus mono, tight grid, published specs.",
    description: "Split hero, value props, a four-column landscape grid, stats grid, split story and a two-column FAQ. Framed cards, small radius, balanced motion.",
    features: ["Landscape framed cards", "Stats grid", "Two-column FAQ", "Value props", "Mono eyebrows", "Sticky-info product page"],
    theme: { direction: "technical", accent: "#2f6bff", neutral: "slate", headerConfig: { style: "minimal" }, footer: { style: "columns" }, product: { layout: "stickyInfo" }, cards: { style: "framed", ratio: "landscape" }, shape: { radius: "sm" }, motionConfig: { level: "balanced", reveal: "slide" } },
    recipe: [{ type: "hero", layout: "split" }, { type: "valueProps", layout: "row", always: true }, { type: "featuredProducts", layout: "grid", config: { columns: 4, limit: 8 } }, { type: "stats", layout: "grid", always: true }, { type: "imageText", layout: "split", design: d("muted") }, { type: "faq", layout: "twoColumn" }, { type: "newsletter", layout: "inline" }],
    swatch: ["#f7f8fa", "#12151b", "#2f6bff"],
  },
  {
    id: "arcade", name: "Arcade", tier: "included", category: "gaming", tags: ["gaming", "technology", "bold"],
    tagline: "Midnight ground, signal accent, tournament energy.",
    description: "Split hero, marquee, four-column framed grid, stats inline, poster product and a banner newsletter on midnight. Unbounded display type, uppercase.",
    features: ["Midnight dark mode", "Poster product", "Inline stats", "Framed zoom cards", "Uppercase display", "Balanced motion"],
    theme: { direction: "technical", accent: "#5cff8a", neutral: "midnight", dna: { expression: 70, energy: 70, edge: 85 }, typography: { display: "unbounded", body: "plexSans", accent: "plexMono", headingTransform: "uppercase" }, headerConfig: { style: "classic", navUppercase: true }, footer: { style: "columns", scheme: "base" }, product: { layout: "stickyInfo" }, cards: { style: "framed", ratio: "landscape", hover: "zoom" }, shape: { radius: "xs" }, motionConfig: { level: "balanced", reveal: "slide", stagger: true } },
    recipe: [{ type: "announcement", layout: "static", config: { background: "brand" }, always: true }, { type: "hero", layout: "split" }, { type: "marquee", config: { items: [{ text: "Tournament grade" }, { text: "Published specs" }, { text: "2-year warranty" }], size: "md" }, always: true }, { type: "featuredProducts", layout: "grid", config: { columns: 4, limit: 8 } }, { type: "stats", layout: "inline", always: true }, { type: "featuredProduct", layout: "poster" }, { type: "faq", layout: "twoColumn" }, { type: "newsletter", layout: "banner" }],
    swatch: ["#0a0d14", "#eef1f6", "#5cff8a"],
  },
  {
    id: "loft", name: "Loft", tier: "included", category: "interior", tags: ["interior", "editorial", "minimal"],
    tagline: "Wide imagery and room to breathe.",
    description: "Editorial hero, wide-image story, a three-column landscape grid, collection list and a centered newsletter. Warm neutrals, wide page, airy spacing.",
    features: ["Wide page width", "Landscape cards", "Wide-image story", "Collection list", "Airy spacing", "Stacked product page"],
    theme: { direction: "editorial", accent: "#4a4238", neutral: "warm", dna: { density: 25 }, typography: { display: "lora", body: "dmSans" }, layout: { width: "wide", sectionSpacing: "airy" }, headerConfig: { style: "classic" }, footer: { style: "brand" }, product: { layout: "stacked" }, cards: { ratio: "landscape", hover: "zoom" }, shape: { radius: "none" } },
    recipe: [{ type: "hero", layout: "editorial" }, { type: "imageText", layout: "wideImage" }, { type: "featuredProducts", layout: "grid", config: { columns: 3, limit: 6 } }, { type: "collectionGrid", layout: "list" }, { type: "text", layout: "columns" }, { type: "newsletter", layout: "centered", design: d("muted") }],
    swatch: ["#faf8f4", "#241f1a", "#4a4238"],
  },
  {
    id: "meadow", name: "Meadow", tier: "included", category: "organic", tags: ["organic", "food", "wellness"],
    tagline: "Garden-fresh, hand-made feel.",
    description: "Centered hero on a muted band, a three-column grid, timeline story, benefits icons and reviews. Soft green accent, rounded corners, warm sand.",
    features: ["Timeline story", "Benefit icons", "Centered hero", "Rounded corners", "Muted bands", "Columns footer"],
    theme: { direction: "organic", accent: "#3f6b3a", neutral: "sand", dna: { tone: 60, geometry: 20 }, typography: { display: "dmSerif", body: "nunito" }, headerConfig: { style: "centered" }, footer: { style: "columns" }, product: { layout: "mediaLeft" }, shape: { radius: "lg" }, buttons: { shape: "pill" } },
    recipe: [{ type: "hero", layout: "center", design: d("muted") }, { type: "featuredProducts", layout: "grid", config: { columns: 3, limit: 6 } }, { type: "story", layout: "timeline", always: true }, { type: "benefits", layout: "icons", always: true }, { type: "reviews" }, { type: "newsletter", layout: "centered", design: d("accent") }],
    swatch: ["#f7f2ea", "#2a231b", "#3f6b3a"],
  },
  {
    id: "orbit", name: "Orbit", tier: "included", category: "futuristic", tags: ["futuristic", "technology", "bold"],
    tagline: "Wide type, dark glass, tomorrow's catalogue.",
    description: "Centered display hero on contrast, marquee, five-column grid, stats grid and a split newsletter. Midnight neutrals with a cold accent and glass surfaces.",
    features: ["Glass surfaces", "Centered display hero", "Five-column grid", "Stats grid", "Uppercase Unbounded", "Expressive motion"],
    theme: { direction: "technical", accent: "#7c8cff", neutral: "midnight", dna: { era: 95, expression: 75, energy: 65 }, typography: { display: "unbounded", body: "manrope", headingTransform: "uppercase", headingScale: 0.9 }, surface: { glass: true, shadow: "medium" }, headerConfig: { style: "centered", navUppercase: true }, footer: { style: "minimal" }, product: { layout: "immersive" }, cards: { style: "elevated", ratio: "square" }, shape: { radius: "lg" }, motionConfig: { level: "expressive", reveal: "scale" } },
    recipe: [{ type: "hero", layout: "center", config: { headingSize: "display", height: "large" }, design: d("contrast") }, { type: "marquee", config: { items: [{ text: "Next generation" }, { text: "Ships now" }, { text: "Engineered" }], size: "sm" }, always: true }, { type: "featuredProducts", layout: "grid", config: { columns: 5, limit: 10 } }, { type: "stats", layout: "grid", always: true }, { type: "imageText", layout: "overlap" }, { type: "newsletter", layout: "split" }],
    swatch: ["#0a0d14", "#eef1f6", "#7c8cff"],
  },
  {
    id: "darkroom", name: "Darkroom", tier: "included", category: "photography", tags: ["photography", "creator", "minimal"],
    tagline: "Image first. Type steps back.",
    description: "An image hero with a bottom-left caption, a gallery mosaic, a three-column portrait grid and a minimal footer on ink. Small quiet headings, zoom hover.",
    features: ["Image hero", "Gallery mosaic", "Portrait grid", "Overlay cards", "Minimal header", "Zoom hover"],
    theme: { direction: "minimal", accent: "#f2f1ee", neutral: "ink", dna: { expression: 25 }, typography: { display: "inter", body: "inter", headingScale: 0.85 }, headerConfig: { style: "minimal" }, footer: { style: "minimal", scheme: "base" }, product: { layout: "gallery" }, cards: { style: "overlay", ratio: "portrait", hover: "zoom" }, shape: { radius: "none" } },
    recipe: [{ type: "imageHero", layout: "bottomLeft", always: true }, { type: "gallery", layout: "mosaic", always: true }, { type: "featuredProducts", layout: "grid", config: { columns: 3, limit: 6, heading: "" } }, { type: "text", layout: "columns" }, { type: "newsletter", layout: "inline", design: d("base", { border: "top" }) }],
    swatch: ["#0f1012", "#f2f1ee", "#3a3a3d"],
  },
  {
    id: "broadside", name: "Broadside", tier: "included", category: "typography", tags: ["typography", "bold", "editorial"],
    tagline: "Words as the picture.",
    description: "A display-size text hero, huge marquee, statement text, list-style product section and a banner newsletter. Archivo display at 130%, sharp corners, no imagery required.",
    features: ["Display text hero", "Huge marquee", "Product list", "Statement text", "130% heading scale", "Sharp corners"],
    theme: { direction: "bold", accent: "#111111", neutral: "pure", dna: { expression: 95, density: 40 }, typography: { display: "archivo", body: "libreFranklin", headingScale: 1.3, headingTransform: "uppercase" }, headerConfig: { style: "classic", navUppercase: true }, footer: { style: "brand" }, product: { layout: "minimal" }, shape: { radius: "none" }, cards: { style: "minimal" } },
    recipe: [{ type: "hero", layout: "left", config: { headingSize: "display", height: "large" } }, { type: "marquee", config: { items: [{ text: "Say it big" }, { text: "Shop the words" }], size: "xl" }, always: true }, { type: "text", layout: "statement", design: d("contrast", { paddingTop: "xl", paddingBottom: "xl" }) }, { type: "featuredProducts", layout: "list", config: { limit: 8 } }, { type: "collectionGrid", layout: "list" }, { type: "newsletter", layout: "banner" }],
    swatch: ["#ffffff", "#111111", "#dcdcdc"],
  },
  {
    id: "souk", name: "Souk", tier: "included", category: "marketplace", tags: ["marketplace", "playful", "food"],
    tagline: "Dense, colourful, everything in reach.",
    description: "Announcement, split hero on an accent band, collection cards, a dense five-column grid, benefit icons and an inline newsletter. Warm neutrals, bright accent, compact spacing.",
    features: ["Dense five-column grid", "Accent hero band", "Collection cards first", "Compact spacing", "Filters and counts on", "Elevated cards"],
    theme: { direction: "playful", accent: "#d9480f", neutral: "warm", dna: { density: 85, tone: 60, energy: 50 }, typography: { display: "poppins", body: "dmSans" }, layout: { density: "compact", width: "wide" }, headerConfig: { style: "classic" }, footer: { style: "columns" }, collection: { columns: 5, showFilters: true, showCount: true }, cards: { style: "elevated", ratio: "square" }, shape: { radius: "md" } },
    recipe: [{ type: "announcement", layout: "static", always: true }, { type: "hero", layout: "split", design: d("accent") }, { type: "collectionGrid", layout: "cards", config: { columns: 4 } }, { type: "featuredProducts", layout: "grid", config: { columns: 5, limit: 10 } }, { type: "benefits", layout: "icons", always: true }, { type: "productGrid", config: { columns: 5, limit: 10 } }, { type: "newsletter", layout: "inline", design: d("muted") }],
    swatch: ["#faf8f4", "#241f1a", "#d9480f"],
  },
];

// ---------------------------------------------------------------------------
// Premium themes — optional one-time purchases.
// ---------------------------------------------------------------------------
const PREMIUM: CatalogTheme[] = [
  {
    id: "monolith", name: "Monolith", tier: "highend", category: "streetwear", tags: ["streetwear", "bold", "creator"],
    tagline: "A drop site with cinema pacing.",
    description: "Video hero with reduced-motion poster fallback, a marquee, asymmetric grid, a story in steps, a poster product, a stats band and a banner newsletter — each on its own custom scheme. Parallax and blur reveal tuned for pace, transparent split header.",
    features: ["Video hero", "Three custom section schemes", "Asymmetric grid + poster product", "Story steps", "Stats band", "Transparent split header", "Parallax + blur reveal", "Immersive product page"],
    theme: { direction: "energy", accent: "#e8ff2a", neutral: "midnight", dna: { expression: 100, energy: 95 }, schemes: [{ id: "acid", name: "Acid", background: "#e8ff2a", foreground: "#0a0a0c" }, { id: "smoke", name: "Smoke", background: "#1b1d22", foreground: "#f2f1ee", accent: "#e8ff2a" }, { id: "bone", name: "Bone", background: "#efe9dc", foreground: "#0a0a0c" }], headerConfig: { style: "transparent", navUppercase: true, logoSize: "lg" }, footer: { style: "brand", scheme: "base" }, product: { layout: "immersive", blocks: ["title", "price", "variants", "quantityBuy", "inventory", "trust", "details", "share"] }, cards: { style: "overlay", ratio: "tall" }, motionConfig: { level: "expressive", reveal: "blur", parallax: true, marqueeSpeed: "fast" } },
    recipe: [{ type: "videoHero", always: true, config: { height: "screen" } }, { type: "marquee", config: { items: [{ text: "Drop 01" }, { text: "Limited" }, { text: "Worldwide" }], size: "xl" }, design: d("custom", { customScheme: "acid", paddingTop: "sm", paddingBottom: "sm" }), always: true }, { type: "featuredProducts", layout: "asymmetric", config: { limit: 6, heading: "The drop" } }, { type: "story", layout: "steps", always: true, design: d("custom", { customScheme: "smoke" }) }, { type: "featuredProduct", layout: "poster" }, { type: "stats", layout: "inline", always: true, design: d("custom", { customScheme: "bone", paddingTop: "lg", paddingBottom: "lg" }) }, { type: "collectionGrid", layout: "mosaic" }, { type: "newsletter", layout: "banner", design: d("custom", { customScheme: "acid" }) }],
    swatch: ["#0a0d14", "#e8ff2a", "#efe9dc"],
  },
  {
    id: "maison", name: "Maison", tier: "highend", category: "fashion", tags: ["fashion", "jewelry", "editorial"],
    tagline: "A house, not a shop.",
    description: "Editorial hero with a wide campaign image, a narrow statement, an editorial grid, a narrow-image story, an editorial quote with portrait, a collection list and a centered newsletter. Two custom schemes (linen and noir), transparent centered header, Cormorant + Jost at 115%, immersive product page.",
    features: ["Campaign editorial hero", "Linen + noir custom schemes", "Narrow 1040px page", "Editorial quote with portrait", "Transparent centered header", "115% heading scale", "Immersive product page", "Fade reveal only"],
    theme: { direction: "luxury", accent: "#1f1b17", neutral: "warm", dna: { expression: 40, density: 12, edge: 95 }, typography: { display: "cormorant", body: "jost", headingScale: 1.15, headingTransform: "uppercase", headingTracking: 0.1 }, schemes: [{ id: "linen", name: "Linen", background: "#efe8dc", foreground: "#1f1b17" }, { id: "noir", name: "Noir", background: "#141210", foreground: "#efe8dc", accent: "#c9b48a" }], layout: { width: "narrow", density: "spacious", sectionSpacing: "airy" }, headerConfig: { style: "transparent", navUppercase: true, logoSize: "lg" }, footer: { style: "centered", scheme: "base" }, product: { layout: "immersive", imageRatio: "tall" }, cards: { ratio: "tall", hover: "zoom", align: "center", priceEmphasis: "muted" }, motionConfig: { level: "subtle", reveal: "fade", parallax: false } },
    recipe: [{ type: "hero", layout: "editorial", config: { headingSize: "xl" }, design: d("custom", { customScheme: "linen", paddingTop: "xl" }) }, { type: "text", layout: "statement", design: d("base", { width: "narrow", align: "center", paddingTop: "xl", paddingBottom: "xl" }) }, { type: "featuredProducts", layout: "editorial", config: { limit: 3, heading: "" } }, { type: "imageText", layout: "narrowImage", design: d("custom", { customScheme: "noir", paddingTop: "xl", paddingBottom: "xl" }) }, { type: "quote", layout: "editorial" }, { type: "collectionGrid", layout: "list" }, { type: "newsletter", layout: "centered", design: d("custom", { customScheme: "linen" }) }],
    swatch: ["#efe8dc", "#141210", "#c9b48a"],
  },
  {
    id: "confection", name: "Confection", tier: "premium", category: "playful", tags: ["playful", "food", "creator"],
    tagline: "Every section its own colour.",
    description: "Centered display hero, marquee, product carousel, gallery mosaic, benefit cards, circle collections, FAQ and a split newsletter — rotating through three custom candy schemes. Fredoka + Nunito, pill everything, lift hover, scale reveal.",
    features: ["Three rotating candy schemes", "Gallery mosaic", "Product carousel", "Benefit cards", "Circle collections", "Pill buttons + XL radius", "Elevated lift cards", "Gallery product page"],
    theme: { direction: "playful", accent: "#ff3d8a", neutral: "pure", dna: { tone: 100, energy: 90, geometry: 10 }, schemes: [{ id: "berry", name: "Berry", background: "#ff3d8a", foreground: "#2a0616" }, { id: "lemon", name: "Lemon", background: "#ffe066", foreground: "#3a2a00" }, { id: "mint", name: "Mint", background: "#8ff0c8", foreground: "#0b3324" }], shape: { radius: "xl" }, buttons: { shape: "pill", size: "lg", hover: "lift" }, headerConfig: { style: "centered" }, footer: { style: "centered", scheme: "muted" }, product: { layout: "gallery" }, cards: { style: "elevated", hover: "lift", align: "center", priceEmphasis: "strong" }, motionConfig: { level: "expressive", reveal: "scale", stagger: true } },
    recipe: [{ type: "hero", layout: "center", config: { headingSize: "display" }, design: d("custom", { customScheme: "berry" }) }, { type: "marquee", config: { items: [{ text: "Sours" }, { text: "Chews" }, { text: "Floss" }, { text: "Gift boxes" }], size: "lg" }, always: true }, { type: "featuredProducts", layout: "carousel", config: { limit: 8 } }, { type: "gallery", layout: "mosaic", always: true, design: d("custom", { customScheme: "lemon" }) }, { type: "benefits", layout: "cards", always: true }, { type: "collectionGrid", layout: "circles", design: d("custom", { customScheme: "mint" }) }, { type: "faq", layout: "accordion" }, { type: "newsletter", layout: "split", design: d("custom", { customScheme: "berry" }) }],
    swatch: ["#ff3d8a", "#ffe066", "#8ff0c8"],
  },
  {
    id: "field-guide", name: "Field Guide", tier: "premium", category: "wellness", tags: ["wellness", "organic", "food"],
    tagline: "Provenance, told chapter by chapter.",
    description: "Split hero, eyebrow intro, a timeline story, portrait grid, benefit rows, quote card, collection list and a centered newsletter on a moss custom scheme. Fraunces + Nunito, soft pill buttons, swap-hover cards, stacked product page with details accordion.",
    features: ["Timeline story", "Quote card", "Benefit rows", "Moss + clay custom schemes", "Swap-hover portrait cards", "Details accordion on product page", "Brand footer with newsletter", "Subtle motion, no parallax"],
    theme: { direction: "organic", accent: "#5b7a3a", neutral: "sand", dna: { geometry: 5, edge: 10, tone: 45 }, typography: { display: "fraunces", body: "nunito" }, schemes: [{ id: "moss", name: "Moss", background: "#2f4a2b", foreground: "#f1ecdf", accent: "#d8c78f" }, { id: "clay", name: "Clay", background: "#e7d8c6", foreground: "#2b2a22" }], shape: { radius: "xl" }, buttons: { style: "soft", shape: "pill" }, headerConfig: { style: "classic" }, footer: { style: "brand", scheme: "muted", showNewsletter: true }, product: { layout: "stacked", blocks: ["vendor", "title", "rating", "price", "variants", "quantityBuy", "trust", "description", "details", "share"] }, cards: { ratio: "portrait", hover: "swap" }, motionConfig: { level: "subtle", reveal: "fade", parallax: false } },
    recipe: [{ type: "hero", layout: "split" }, { type: "text", layout: "eyebrow", design: d("custom", { customScheme: "clay" }) }, { type: "story", layout: "timeline", always: true }, { type: "featuredProducts", layout: "grid", config: { columns: 3, limit: 6 } }, { type: "benefits", layout: "rows", always: true, design: d("custom", { customScheme: "moss" }) }, { type: "quote", layout: "card" }, { type: "collectionGrid", layout: "list" }, { type: "newsletter", layout: "centered", design: d("custom", { customScheme: "clay" }) }],
    swatch: ["#f7f2ea", "#2f4a2b", "#e7d8c6"],
  },
  {
    id: "signal", name: "Signal", tier: "premium", category: "technology", tags: ["technology", "gaming", "futuristic"],
    tagline: "Spec-sheet confidence.",
    description: "Announcement, split hero on a graphite scheme, value props, stats grid, four-column framed grid, poster product, split story, two-column FAQ and an inline newsletter. Space Grotesk + IBM Plex with mono eyebrows, glass surfaces, sticky-info product page.",
    features: ["Graphite + signal custom schemes", "Stats grid + value props", "Poster product", "Two-column FAQ", "Glass surfaces", "Framed landscape cards", "Sticky-info product page", "Balanced stagger motion"],
    theme: { direction: "technical", accent: "#38d996", neutral: "midnight", dna: { expression: 60, energy: 60 }, typography: { display: "spaceGrotesk", body: "plexSans", accent: "plexMono", eyebrowStyle: "mono" }, schemes: [{ id: "graphite", name: "Graphite", background: "#151a24", foreground: "#e6ecf5", accent: "#38d996" }, { id: "signal", name: "Signal", background: "#38d996", foreground: "#062016" }], surface: { glass: true, shadow: "soft" }, headerConfig: { style: "classic", navUppercase: true }, footer: { style: "columns", scheme: "base" }, product: { layout: "stickyInfo", blocks: ["vendor", "title", "rating", "price", "variants", "quantityBuy", "inventory", "trust", "details", "description", "tags", "share"] }, cards: { style: "framed", ratio: "landscape", hover: "zoom" }, shape: { radius: "sm" }, motionConfig: { level: "balanced", reveal: "slide", stagger: true } },
    recipe: [{ type: "announcement", layout: "static", config: { background: "brand" }, always: true }, { type: "hero", layout: "split", design: d("custom", { customScheme: "graphite" }) }, { type: "valueProps", layout: "grid", always: true }, { type: "stats", layout: "grid", always: true, design: d("custom", { customScheme: "signal" }) }, { type: "featuredProducts", layout: "grid", config: { columns: 4, limit: 8 } }, { type: "featuredProduct", layout: "poster" }, { type: "imageText", layout: "split", design: d("custom", { customScheme: "graphite" }) }, { type: "faq", layout: "twoColumn" }, { type: "newsletter", layout: "inline" }],
    swatch: ["#0a0d14", "#151a24", "#38d996"],
  },
  {
    id: "gallery", name: "Gallery", tier: "standard", category: "photography", tags: ["photography", "creator", "minimal"],
    tagline: "Prints, exhibited.",
    description: "Image hero with editorial caption, masonry gallery, a three-column tall grid, a full-width image, statement text and an inline newsletter. Minimal ink chrome, hairline borders, zoom hover, gallery product page.",
    features: ["Masonry gallery", "Editorial image hero", "Full-width image", "Tall grid", "Paper custom scheme for the statement", "Hairline chrome", "Gallery product page"],
    theme: { direction: "minimal", accent: "#f2f1ee", neutral: "ink", dna: { expression: 25, density: 30 }, typography: { display: "manrope", body: "manrope", headingScale: 0.9 }, schemes: [{ id: "paper", name: "Paper", background: "#efece4", foreground: "#161616" }], surface: { borderWidth: 1 }, headerConfig: { style: "minimal", logoSize: "sm" }, footer: { style: "minimal", scheme: "base" }, product: { layout: "gallery", imageRatio: "tall" }, cards: { ratio: "tall", hover: "zoom", priceEmphasis: "muted" }, shape: { radius: "none" } },
    recipe: [{ type: "imageHero", layout: "editorial", always: true }, { type: "gallery", layout: "masonry", always: true }, { type: "featuredProducts", layout: "grid", config: { columns: 3, limit: 6, heading: "Available prints" } }, { type: "fullImage", always: true, config: { height: "medium" } }, { type: "text", layout: "statement", design: d("custom", { customScheme: "paper", width: "narrow", paddingTop: "xl", paddingBottom: "xl" }) }, { type: "newsletter", layout: "inline", design: d("base", { border: "top" }) }],
    swatch: ["#0f1012", "#efece4", "#2c2c30"],
  },
  {
    id: "bazaar", name: "Bazaar", tier: "standard", category: "marketplace", tags: ["marketplace", "food", "playful"],
    tagline: "A big catalogue that still feels curated.",
    description: "Announcement marquee, collection hero, six-collection mosaic, dense five-column grid, benefit icons, a list of best sellers and a banner newsletter on a saffron scheme. Compact spacing, elevated cards, filters and counts on.",
    features: ["Collection hero", "Six-collection mosaic", "Best-sellers list", "Saffron custom scheme", "Dense five-column grid", "Filters + counts on", "Compact spacing", "Media-left product page"],
    theme: { direction: "playful", accent: "#d9480f", neutral: "warm", dna: { density: 90, tone: 55 }, typography: { display: "poppins", body: "dmSans" }, schemes: [{ id: "saffron", name: "Saffron", background: "#f2b134", foreground: "#2a1a00" }], layout: { density: "compact", width: "wide" }, headerConfig: { style: "classic" }, footer: { style: "columns" }, collection: { columns: 5, showFilters: true, showCount: true }, product: { layout: "mediaLeft" }, cards: { style: "elevated", ratio: "square", priceEmphasis: "strong" }, shape: { radius: "md" } },
    recipe: [{ type: "announcement", layout: "marquee", always: true }, { type: "collectionHero", layout: "banner" }, { type: "collectionGrid", layout: "mosaic" }, { type: "featuredProducts", layout: "grid", config: { columns: 5, limit: 10, heading: "New in" } }, { type: "benefits", layout: "icons", always: true, design: d("muted") }, { type: "featuredProducts", layout: "list", config: { source: "bestsellers", limit: 5, heading: "Best sellers" } }, { type: "newsletter", layout: "banner", design: d("custom", { customScheme: "saffron" }) }],
    swatch: ["#faf8f4", "#f2b134", "#d9480f"],
  },
];

export const THEME_CATALOG: CatalogTheme[] = [...INCLUDED, ...PREMIUM];
const BY_ID = new Map(THEME_CATALOG.map((t) => [t.id, t]));
export function getCatalogTheme(id: string): CatalogTheme | undefined { return BY_ID.get(id); }
export function themePriceCents(theme: CatalogTheme): number { return THEME_PRICES_CENTS[theme.tier]; }
export const TIER_LABEL: Record<ThemeTier, string> = { included: "Included", standard: "Premium · $5", premium: "Premium · $10", highend: "Premium · $15" };
