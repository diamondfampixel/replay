import { describe, expect, it } from "vitest";
import { DEFAULT_DNA, DNA_MOVES, applyDnaMove, dnaDefaults, dnaSchema, describeDna } from "@/lib/storefront/dna";
import { sanitizeCustomCss } from "@/lib/storefront/custom-css";
import { DESIGN_DIRECTIONS, DIRECTION_PRESETS, contrastRatio, resolveTheme, themeWarnings } from "@/lib/storefront/theme";

describe("Design DNA", () => {
  it("clamps axes and fills defaults", () => {
    expect(dnaSchema.safeParse({ expression: 150 }).success).toBe(false);
    expect(dnaSchema.parse({})).toEqual(DEFAULT_DNA);
  });

  it("derives coordinated token defaults — sharp+dense+energetic is not soft+minimal+calm", () => {
    const sharp = dnaDefaults({ ...DEFAULT_DNA, edge: 90, density: 80, energy: 90, expression: 90 });
    const soft = dnaDefaults({ ...DEFAULT_DNA, edge: 5, density: 10, energy: 10, expression: 20 });
    expect(sharp.radius).toBe("none");
    expect(soft.radius).toBe("xl");
    expect(sharp.motionLevel).toBe("expressive");
    expect(soft.motionLevel).toBe("off");
    expect(sharp.headingWeight).toBeGreaterThan(soft.headingWeight);
    expect(sharp.density).toBe("compact");
    expect(soft.density).toBe("spacious");
  });

  it("named moves change several axes together and stay in bounds", () => {
    const premium = applyDnaMove({ ...DEFAULT_DNA, tone: 80, energy: 90 }, "premium");
    expect(premium.tone).toBeLessThan(80);
    expect(premium.energy).toBeLessThan(90);
    expect(premium.density).toBeLessThan(DEFAULT_DNA.density);
    const maxed = applyDnaMove({ ...DEFAULT_DNA, energy: 95 }, "energetic", 3);
    expect(maxed.energy).toBe(100);
    for (const move of Object.keys(DNA_MOVES)) expect(typeof describeDna(applyDnaMove(DEFAULT_DNA, move as keyof typeof DNA_MOVES))).toBe("string");
  });

  it("every direction preset has a distinct DNA fingerprint", () => {
    const seen = new Set(DESIGN_DIRECTIONS.map((d) => JSON.stringify(DIRECTION_PRESETS[d].dna)));
    expect(seen.size).toBe(DESIGN_DIRECTIONS.length);
  });

  it("per-store DNA overrides bend a preset without replacing it", () => {
    const t = resolveTheme({ theme: { direction: "luxury", dna: { energy: 95 } }, primaryColor: "#000000" });
    expect(t.dna.energy).toBe(95);
    expect(t.dna.tone).toBe(DIRECTION_PRESETS.luxury.dna.tone);
    // preset opinion (motion: subtle) still wins over DNA-derived expressive: presets are explicit.
    expect(t.motion).toBe("subtle");
    // …but a v2 motion override wins over the preset.
    const t2 = resolveTheme({ theme: { direction: "luxury", motionConfig: { level: "expressive" } }, primaryColor: "#000000" });
    expect(t2.motion).toBe("expressive");
  });
});

describe("theme v2 resolution", () => {
  it("still resolves v1 flat themes identically enough (no crash, keys honoured)", () => {
    const v1 = { direction: "bold", radius: "pill", neutral: "sand", motion: "none", header: "centered", accent: "#ff2d87" };
    const t = resolveTheme({ theme: v1, primaryColor: "#000000" });
    expect(t.vars["--st-radius"]).toBe("9999px");
    expect(t.motion).toBe("off");
    expect(t.header.style).toBe("centered");
    expect(t.vars["--st-accent"]).toBe("#ff2d87");
  });

  it("supports dark neutrals with legible derived roles", () => {
    const t = resolveTheme({ theme: { direction: "energy" }, primaryColor: "#7cf2c4" });
    expect(t.isDark).toBe(true);
    expect(contrastRatio(t.vars["--st-fg"], t.vars["--st-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.vars["--st-muted-fg"], t.vars["--st-surface-alt"])).toBeGreaterThanOrEqual(4.5);
  });

  it("colour roles, custom schemes, layout width and product blocks resolve", () => {
    const t = resolveTheme({
      theme: {
        direction: "minimal",
        colors: { background: "#101010", foreground: "#fafafa", primary: "#e7ff2f" },
        schemes: [{ id: "cream", name: "Cream", background: "#f3ead9", foreground: "#1a1712" }],
        layout: { width: "wide", sectionSpacing: "airy" },
        product: { layout: "immersive", blocks: ["title", "price", "quantityBuy"] },
        collection: { columns: 5, mobileColumns: 1 },
      },
      primaryColor: "#000000",
    });
    expect(t.vars["--st-bg"]).toBe("#101010");
    expect(t.vars["--st-scheme-cream-bg"]).toBe("#f3ead9");
    expect(t.vars["--st-max-width"]).toBe("1440px");
    expect(t.product.layout).toBe("immersive");
    expect(t.product.blocks).toEqual(["title", "price", "quantityBuy"]);
    expect(t.collection.columns).toBe(5);
    expect(contrastRatio(t.vars["--st-btn-fg"], t.vars["--st-btn-bg"])).toBeGreaterThanOrEqual(4.5);
  });

  it("warns instead of silently shipping unreadable combinations", () => {
    const t = resolveTheme({ theme: { colors: { background: "#ffffff", foreground: "#dddddd" } }, primaryColor: "#000000" });
    expect(themeWarnings(t).some((w) => /Body text contrast/.test(w))).toBe(true);
  });

  it("garbage stored themes never throw", () => {
    for (const bad of [null, 7, "x", { direction: "nope" }, { dna: { energy: "high" } }, { colors: { primary: "red" } }]) {
      expect(() => resolveTheme({ theme: bad, primaryColor: "#123456" })).not.toThrow();
    }
  });
});

describe("custom CSS sanitizer", () => {
  it("scopes to the storefront root and strips remote loads, tags and expressions", () => {
    const { css, warnings } = sanitizeCustomCss(`@import url(https://evil); h1 { background: url(https://t.example/px.gif); color: red } </style><script>x</script> .x{ width: expression(1) }`);
    expect(css.startsWith(".st-root {")).toBe(true);
    expect(css).not.toMatch(/@import|url\(|<script|<\/style|expression\(/i);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
  it("caps size and passes ordinary CSS through", () => {
    const big = "a{color:red}".repeat(3000);
    const { css, warnings } = sanitizeCustomCss(big);
    expect(css.length).toBeLessThan(21_000);
    expect(warnings[0]).toMatch(/limited/);
    expect(sanitizeCustomCss(".st-btn { letter-spacing: .1em }").css).toContain("letter-spacing: .1em");
    expect(sanitizeCustomCss("").css).toBe("");
  });
});

describe("custom CSS containment", () => {
  it("cannot escape the storefront scope with a stray closing brace", () => {
    const { css, warnings } = sanitizeCustomCss("} body { background: red } .x { color: blue }");
    // Only one top-level block: the .st-root wrapper.
    let depth = 0, topLevelBlocks = 0;
    for (const ch of css) { if (ch === "{") { if (depth === 0) topLevelBlocks += 1; depth += 1; } else if (ch === "}") depth -= 1; }
    expect(topLevelBlocks).toBe(1);
    expect(depth).toBe(0);
    expect(css.startsWith(".st-root {")).toBe(true);
    expect(warnings.join(" ")).toMatch(/Unbalanced/);
  });

  it("closes an unclosed block so the wrapper still holds", () => {
    const { css } = sanitizeCustomCss(".a { color: red; .b { color: blue;");
    let depth = 0;
    for (const ch of css) { if (ch === "{") depth += 1; else if (ch === "}") depth -= 1; }
    expect(depth).toBe(0);
  });

  it("strips remote loads and script-ish constructs", () => {
    const { css, warnings } = sanitizeCustomCss("@import url(https://evil.example/x.css); .a { background: url(https://evil.example/p.png); behavior: url(x.htc); color: expression(alert(1)) } </style><script>alert(1)</script>");
    expect(css).not.toMatch(/@import|https:\/\/evil|expression\(|<script|<\/style|behavior:/i);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});
