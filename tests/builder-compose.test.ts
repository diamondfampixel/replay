import { describe, expect, it } from "vitest";
import { composeHomepage, describeComposition, type ComposeBrief } from "@/lib/storefront/compose";
import { DIRECTION_PRESETS, resolveTheme } from "@/lib/storefront/theme";
import { SECTION_META, normaliseSectionConfig, sectionDefaultsFor, sectionSchemas, SECTION_TYPES } from "@/lib/storefront/sections";
import { SECTION_FIELDS, DESIGN_FIELDS, describeSectionFields } from "@/lib/storefront/section-fields";

const brief = (over: Partial<ComposeBrief> = {}): ComposeBrief => ({
  name: "Nocturne Division",
  description: "Premium blackout streetwear cut for the after-hours city. Heavyweight essentials made in limited runs.",
  industry: "Streetwear",
  catalog: { productCount: 6, collectionSlugs: ["drops", "essentials"], featuredProductId: "p1", hasReviews: false },
  ...over,
});

const themeFor = (direction: keyof typeof DIRECTION_PRESETS) => resolveTheme({ theme: { direction }, primaryColor: "#111111" });

describe("composition engine", () => {
  it("is deterministic: same DNA + brief → identical page", () => {
    const a = composeHomepage(themeFor("bold"), brief());
    const b = composeHomepage(themeFor("bold"), brief());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("composes genuinely different pages for different directions", () => {
    const sig = (d: keyof typeof DIRECTION_PRESETS) => composeHomepage(themeFor(d), brief()).map((s) => `${s.type}:${s.config.layout ?? "-"}`).join(">");
    const signatures = new Set(["bold", "luxury", "playful", "technical", "organic", "creator"].map((d) => sig(d as never)));
    expect(signatures.size).toBe(6);
    // The hero composition itself differs, not just the section order.
    const heroes = new Set(["bold", "luxury", "playful", "editorial", "creator"].map((d) => composeHomepage(themeFor(d as never), brief())[0].config.layout));
    expect(heroes.size).toBeGreaterThanOrEqual(4);
  });

  it("never invents facts: benefits, stats, FAQs, quotes appear only when supplied", () => {
    const bare = composeHomepage(themeFor("technical"), brief());
    expect(bare.some((s) => ["benefits", "stats", "faq", "quote", "valueProps", "testimonials", "marquee"].includes(s.type))).toBe(false);
    const withFacts = composeHomepage(themeFor("technical"), brief({ facts: { benefits: [{ title: "2-year warranty", body: "On everything." }], stats: [{ value: "12k", label: "orders shipped" }], faqs: [{ q: "Ship abroad?", a: "Yes." }] } }));
    expect(withFacts.map((s) => s.type)).toEqual(expect.arrayContaining(["valueProps", "stats", "faq"]));
    const organic = composeHomepage(themeFor("organic"), brief({ facts: { benefits: [{ title: "Hand picked" }] } }));
    expect(organic.some((s) => s.type === "benefits")).toBe(true);
    const stat = withFacts.find((s) => s.type === "stats")!;
    expect(stat.config.items).toEqual([{ value: "12k", label: "orders shipped" }]);
  });

  it("skips reviews when the store has none published and collection grids when there are no collections", () => {
    const page = composeHomepage(themeFor("modern"), brief({ catalog: { productCount: 3, collectionSlugs: [], hasReviews: false } }));
    expect(page.some((s) => s.type === "reviews")).toBe(false);
    expect(page.some((s) => s.type === "collectionGrid")).toBe(false);
    const withReviews = composeHomepage(themeFor("modern"), brief({ catalog: { productCount: 3, collectionSlugs: ["a"], hasReviews: true } }));
    expect(withReviews.some((s) => s.type === "reviews")).toBe(true);
  });

  it("honours a requested section list, keeps the hero, and appends types the recipe lacked", () => {
    const page = composeHomepage(themeFor("editorial"), brief({ wanted: ["faq", "newsletter", "benefits"], facts: { faqs: [{ q: "Q", a: "A" }], benefits: [{ title: "B" }] } }));
    expect(page[0].type).toBe("hero");
    expect(page.map((s) => s.type)).toEqual(["hero", "faq", "benefits", "newsletter"].filter((t) => page.some((s) => s.type === t)));
    expect(page.some((s) => s.type === "featuredProducts")).toBe(false);
  });

  it("every composed config validates against its section schema", () => {
    for (const direction of Object.keys(DIRECTION_PRESETS) as Array<keyof typeof DIRECTION_PRESETS>) {
      for (const s of composeHomepage(themeFor(direction), brief({ facts: { benefits: [{ title: "x" }], marquee: ["a"], quote: { quote: "q" }, announcement: "hi" } }))) {
        const parsed = sectionSchemas[s.type].safeParse(s.config);
        expect(parsed.success, `${direction}/${s.type}: ${parsed.success ? "" : parsed.error.message}`).toBe(true);
        if (SECTION_META[s.type].layouts && typeof s.config.layout === "string") {
          expect(SECTION_META[s.type].layouts!.map((l) => l.id)).toContain(s.config.layout);
        }
      }
    }
  });

  it("describes the plan in merchant language", () => {
    const lines = describeComposition(composeHomepage(themeFor("bold"), brief()));
    expect(lines[0]).toMatch(/^Hero · Full-bleed image — “Nocturne Division”/);
  });
});

describe("section contract", () => {
  it("migrates v1 configs (background/spacing/imageUrl) into the v2 design + media shape", () => {
    const v1 = normaliseSectionConfig("hero", { headline: "Old", background: "brand", spacing: "roomy", imageUrl: "/x.png", align: "center" });
    expect(v1.design).toMatchObject({ scheme: "accent", paddingTop: "lg", paddingBottom: "lg", align: "center" });
    expect((v1.media as { url: string }).url).toBe("/x.png");
    const grid = normaliseSectionConfig("featuredProducts", { heading: "Best", background: "ink", spacing: "compact" });
    expect(grid.design).toMatchObject({ scheme: "contrast", paddingTop: "sm" });
    expect(grid.layout).toBe("grid");
  });

  it("salvages a config with one bad key instead of discarding the section", () => {
    const fixed = normaliseSectionConfig("hero", { headline: "Keep me", layout: "not-a-layout", height: 42 });
    expect(fixed.headline).toBe("Keep me");
    expect(fixed.layout).toBe("left");
    expect(fixed.height).toBe("large");
  });

  it("gives every section type editor fields, metadata and a schema, and every declared field exists in the schema", () => {
    for (const type of SECTION_TYPES) {
      expect(SECTION_META[type].label).toBeTruthy();
      const shape = (sectionSchemas[type] as unknown as { shape: Record<string, unknown> }).shape;
      for (const field of SECTION_FIELDS[type]) expect(Object.keys(shape), `${type}.${field.key}`).toContain(field.key);
      for (const layout of SECTION_META[type].layouts ?? []) {
        expect(sectionSchemas[type].safeParse({ layout: layout.id }).success, `${type} layout ${layout.id}`).toBe(true);
      }
      expect(describeSectionFields(type)).toContain(SECTION_FIELDS[type][0]?.key ?? "");
    }
    expect(DESIGN_FIELDS.map((f) => f.key)).toEqual(expect.arrayContaining(["scheme", "width", "paddingTop", "paddingBottom", "align", "motion", "reveal", "mobileHide"]));
  });

  it("DNA-aware defaults: a section added to a luxury store does not arrive looking like a playful one", () => {
    const luxury = sectionDefaultsFor("hero", themeFor("luxury"));
    const playful = sectionDefaultsFor("hero", themeFor("playful"));
    expect(luxury.layout).not.toBe(playful.layout);
    expect((luxury.design as { paddingTop: string }).paddingTop).toBe("lg");
    const energy = sectionDefaultsFor("featuredProducts", themeFor("energy"));
    expect(energy.layout).toBe("asymmetric");
  });
});
