import { SECTION_META, sectionDefaultsFor, type SectionType } from "@/lib/storefront/sections";
import type { ResolvedTheme } from "@/lib/storefront/theme";

/**
 * Deterministic composition engine.
 *
 * Given a store's resolved design (direction + DNA) and an honest brief, it
 * assembles a homepage from the section primitives: which sections, in what
 * order, with which compositions, and with what copy. No randomness — the
 * same DNA and brief always compose the same page — and no invented facts:
 * sections that need real claims (benefits, stats, FAQ, quotes) are only
 * included when the brief supplies them. The AI designer calls this with a
 * brief it assembled; onboarding calls it with the store profile.
 */
export type ThemeLike = Pick<ResolvedTheme, "dna" | "direction" | "motion" | "cards">;

export type ComposeBrief = {
  name: string;
  description?: string | null;
  tagline?: string | null;
  industry?: string | null;
  goal?: "launch" | "catalog" | "story" | "conversion";
  emphasis?: string | null;
  facts?: {
    benefits?: Array<{ title: string; body?: string; icon?: string }>;
    faqs?: Array<{ q: string; a: string }>;
    stats?: Array<{ value: string; label: string }>;
    marquee?: string[];
    quote?: { quote: string; author?: string; role?: string };
    announcement?: string;
  };
  catalog: { productCount: number; collectionSlugs: string[]; featuredProductId?: string | null; hasReviews: boolean };
  /** Restrict/extend to these section types (onboarding checkboxes). */
  wanted?: string[];
};

export type ComposedSection = { type: SectionType; config: Record<string, unknown> };

type Slot = { type: SectionType; layout?: string; patch?: (b: ComposeBrief, t: ThemeLike) => Record<string, unknown> | null };

const short = (s: string | null | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const words = (s: string | null | undefined, n: number) => (s ?? "").split(/\s+/).slice(0, n).join(" ");
/** First sentence of a description, capped — reads as a heading, never a fragment. */
const firstSentence = (s: string | null | undefined, max = 90) => {
  const sentence = (s ?? "").split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  return sentence.length <= max ? sentence : `${words(sentence, 10)}…`;
};

function newsletterCopy(t: ThemeLike) {
  const { tone, era } = t.dna;
  if (tone >= 65) return { heading: "Stay in the loop", body: "New drops, restocks and the occasional treat. Unsubscribe any time." };
  if (era <= 35 || tone <= 15) return { heading: "The letter", body: "Occasional notes on new work and what is coming next. Nothing else." };
  return { heading: "Get the restock notes", body: "One email when something returns or something new lands." };
}
function heroCopy(b: ComposeBrief) {
  const headline = short(b.tagline, 90) || (b.goal === "launch" ? `New from ${b.name}` : b.name);
  const subheadline = short(b.description, 150);
  return { headline, subheadline, ctaLabel: b.catalog.productCount ? "Shop now" : "Explore", ctaHref: "/shop" };
}

const HERO: Slot = { type: "hero", patch: (b) => heroCopy(b) };
const FEATURED = (layout: string, limit = 4, columns = 4): Slot => ({ type: "featuredProducts", layout, patch: (b) => ({ heading: b.goal === "launch" ? "The drop" : "Featured", source: "newest", limit, columns, ctaLabel: b.catalog.productCount > limit ? "View all" : "" }) });
const ABOUT = (layout: string): Slot => ({ type: "imageText", layout, patch: (b) => (b.description ? { heading: `About ${b.name}`, body: short(b.description, 600), ctaLabel: "Our story", ctaHref: "/pages/about" } : null) });
const COLLECTIONS = (layout: string): Slot => ({ type: "collectionGrid", layout, patch: (b) => (b.catalog.collectionSlugs.length ? { heading: "Shop by collection", collectionSlugs: b.catalog.collectionSlugs.slice(0, 6) } : null) });
const REVIEWS: Slot = { type: "reviews", patch: (b) => (b.catalog.hasReviews ? { heading: "What customers say", limit: 3, minRating: 4 } : null) };
const NEWSLETTER = (layout: string): Slot => ({ type: "newsletter", layout, patch: (_b, t) => ({ ...newsletterCopy(t), buttonLabel: "Subscribe" }) });
const BENEFITS = (layout: string): Slot => ({ type: "benefits", layout, patch: (b) => (b.facts?.benefits?.length ? { heading: "", items: b.facts.benefits.map((x) => ({ title: x.title, body: x.body ?? "", icon: x.icon ?? "" })) } : null) });
const VALUE_PROPS: Slot = { type: "valueProps", patch: (b) => (b.facts?.benefits?.length ? { items: b.facts.benefits.slice(0, 4).map((x) => ({ title: x.title, body: x.body ?? "", icon: x.icon ?? "check" })) } : null) };
const FAQ = (layout: string): Slot => ({ type: "faq", layout, patch: (b) => (b.facts?.faqs?.length ? { heading: "Common questions", items: b.facts.faqs } : null) });
const STATS = (layout: string): Slot => ({ type: "stats", layout, patch: (b) => (b.facts?.stats?.length ? { heading: "", items: b.facts.stats } : null) });
const MARQUEE = (size: string): Slot => ({ type: "marquee", patch: (b) => (b.facts?.marquee?.length ? { items: b.facts.marquee.map((text) => ({ text })), size } : null) });
const QUOTE = (layout: string): Slot => ({ type: "quote", layout, patch: (b) => (b.facts?.quote ? { quote: b.facts.quote.quote, author: b.facts.quote.author ?? "", role: b.facts.quote.role ?? "" } : null) });
const ANNOUNCE = (layout: string, background: string): Slot => ({ type: "announcement", layout, patch: (b) => (b.facts?.announcement ? { text: b.facts.announcement, background } : null) });
const STATEMENT: Slot = { type: "text", layout: "statement", patch: (b) => (b.description ? { heading: firstSentence(b.description, 120), body: "" } : null) };
const INTRO: Slot = { type: "text", layout: "eyebrow", patch: (b) => (b.description ? { eyebrow: b.industry ?? "About", heading: firstSentence(b.description), body: short(b.description, 400) } : null) };
const FEATURED_PRODUCT = (layout: string): Slot => ({ type: "featuredProduct", layout, patch: (b) => (b.catalog.featuredProductId ? { productId: b.catalog.featuredProductId, eyebrow: b.goal === "launch" ? "Just landed" : "Featured" } : null) });
const STORY: Slot = { type: "story", layout: "steps", patch: (b) => (b.facts?.benefits && b.facts.benefits.length >= 3 ? { heading: "How it works", items: b.facts.benefits.slice(0, 4).map((x) => ({ title: x.title, body: x.body ?? "" })) } : null) };

/** One recipe per direction; DNA still bends every section's defaults. */
const RECIPES: Record<ThemeLike["direction"], Slot[]> = {
  modern: [ANNOUNCE("static", "ink"), { ...HERO, layout: "split" }, VALUE_PROPS, FEATURED("grid"), ABOUT("split"), COLLECTIONS("cards"), REVIEWS, FAQ("accordion"), NEWSLETTER("centered")],
  editorial: [{ ...HERO, layout: "editorial" }, STATEMENT, FEATURED("editorial", 3), ABOUT("wideImage"), QUOTE("editorial"), COLLECTIONS("list"), REVIEWS, NEWSLETTER("centered")],
  minimal: [{ ...HERO, layout: "minimal" }, FEATURED("grid", 6, 3), INTRO, COLLECTIONS("cards"), REVIEWS, NEWSLETTER("inline")],
  bold: [ANNOUNCE("marquee", "brand"), { ...HERO, layout: "fullBleed" }, MARQUEE("lg"), FEATURED("asymmetric", 6), ABOUT("overlap"), COLLECTIONS("mosaic"), STATS("row"), REVIEWS, NEWSLETTER("banner")],
  luxury: [{ ...HERO, layout: "minimal" }, FEATURED("editorial", 3), STATEMENT, ABOUT("narrowImage"), QUOTE("large"), COLLECTIONS("list"), NEWSLETTER("centered")],
  playful: [ANNOUNCE("static", "brand"), { ...HERO, layout: "center" }, MARQUEE("md"), FEATURED("carousel", 8), BENEFITS("cards"), COLLECTIONS("circles"), REVIEWS, FAQ("accordion"), NEWSLETTER("split")],
  technical: [{ ...HERO, layout: "split" }, VALUE_PROPS, FEATURED("grid", 8, 4), STATS("grid"), ABOUT("split"), FAQ("twoColumn"), NEWSLETTER("inline")],
  organic: [{ ...HERO, layout: "split" }, INTRO, FEATURED("grid", 6, 3), BENEFITS("rows"), ABOUT("stacked"), REVIEWS, NEWSLETTER("centered")],
  energy: [ANNOUNCE("marquee", "ink"), { ...HERO, layout: "fullBleed" }, MARQUEE("xl"), FEATURED("asymmetric", 6), COLLECTIONS("mosaic"), FEATURED_PRODUCT("poster"), STATS("inline"), NEWSLETTER("banner")],
  creator: [{ ...HERO, layout: "asymmetric" }, MARQUEE("lg"), FEATURED("asymmetric", 6), STORY, COLLECTIONS("circles"), QUOTE("editorial"), REVIEWS, NEWSLETTER("banner")],
};

export function composeHomepage(theme: ThemeLike, brief: ComposeBrief): ComposedSection[] {
  const recipe = RECIPES[theme.direction] ?? RECIPES.modern;
  const wanted = brief.wanted?.filter((w) => w in SECTION_META) as SectionType[] | undefined;

  const out: ComposedSection[] = [];
  const emit = (slot: Slot) => {
    if (wanted && wanted.length && slot.type !== "hero" && !wanted.includes(slot.type)) return;
    const patch = slot.patch ? slot.patch(brief, theme) : {};
    if (patch === null) return;
    const base = sectionDefaultsFor(slot.type, theme);
    const config: Record<string, unknown> = { ...base, ...patch, ...(slot.layout ? { layout: slot.layout } : {}) };
    // A hero on a store whose DNA is very expressive gets the display size.
    if (slot.type === "hero" && theme.dna.expression >= 75) config.headingSize = "display";
    if (brief.emphasis && slot.type === "hero" && !brief.tagline) config.eyebrow = short(brief.emphasis, 60);
    out.push({ type: slot.type, config });
  };
  recipe.forEach(emit);

  // Requested types the recipe did not cover are appended before the newsletter.
  if (wanted?.length) {
    const have = new Set(out.map((s) => s.type));
    const extras: Slot[] = wanted.filter((w) => !have.has(w)).map((type) => EXTRA[type] ?? { type });
    const tail = out.findIndex((s) => s.type === "newsletter");
    const before = tail >= 0 ? out.splice(tail) : [];
    extras.forEach(emit);
    out.push(...before);
  }

  // Never two of the same type back to back, and never end on a marquee.
  return out.filter((s, i) => i === 0 || s.type !== out[i - 1].type);
}

const EXTRA: Partial<Record<SectionType, Slot>> = {
  featuredProducts: FEATURED("grid"), imageText: ABOUT("split"), collectionGrid: COLLECTIONS("cards"), reviews: REVIEWS, faq: FAQ("accordion"),
  benefits: BENEFITS("columns"), newsletter: NEWSLETTER("centered"), announcement: ANNOUNCE("static", "ink"), testimonials: { type: "testimonials", patch: () => ({ items: [] }) },
};

/** One line per section, for confirmations and the assistant's plan. */
export function describeComposition(sections: ComposedSection[]): string[] {
  return sections.map((s) => {
    const meta = SECTION_META[s.type];
    const layout = typeof s.config.layout === "string" ? meta.layouts?.find((l) => l.id === s.config.layout)?.label : undefined;
    const title = typeof s.config.headline === "string" ? s.config.headline : typeof s.config.heading === "string" ? s.config.heading : "";
    return `${meta.label}${layout ? ` · ${layout}` : ""}${title ? ` — “${title.slice(0, 50)}”` : ""}`;
  });
}
