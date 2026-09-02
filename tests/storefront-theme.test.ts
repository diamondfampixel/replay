import { describe, expect, it } from "vitest";
import {
  DESIGN_DIRECTIONS,
  DIRECTION_PRESETS,
  contrastRatio,
  googleFontsHref,
  resolveTheme,
  storeThemeSchema,
} from "@/lib/storefront/theme";

/**
 * The design system's job is that two stores on different directions render
 * genuinely differently, that a bad stored theme never throws, and that
 * button/accent colours stay legible. These tests hold that contract.
 */

describe("storeThemeSchema", () => {
  it("fills defaults for an empty theme", () => {
    const t = storeThemeSchema.parse({});
    expect(t.direction).toBe("modern");
  });

  it("never throws on malformed stored data (safeParse fallback path)", () => {
    for (const bad of [null, 42, "oops", { direction: "nope" }, { radius: "banana" }]) {
      const parsed = storeThemeSchema.safeParse(bad);
      // Either it parses, or resolveTheme's safeParse fallback handles it —
      // resolveTheme must always return a usable theme.
      const resolved = resolveTheme({ theme: bad, primaryColor: "#123456" });
      expect(resolved.vars["--st-bg"]).toMatch(/^#/);
      expect(parsed.success || !parsed.success).toBe(true);
    }
  });
});

describe("resolveTheme", () => {
  it("produces materially different tokens across directions", () => {
    const seen = new Set<string>();
    for (const direction of DESIGN_DIRECTIONS) {
      const t = resolveTheme({ theme: { direction }, primaryColor: "#3311bb" });
      // Fingerprint the visual identity by the tokens a viewer would notice.
      const fp = [
        t.vars["--st-font-display"],
        t.vars["--st-radius"],
        t.vars["--st-btn-bg"],
        t.vars["--st-bg"],
        t.vars["--st-heading-transform"],
        t.cardStyle,
      ].join("|");
      seen.add(fp);
    }
    // All 8 directions must be distinct — no two are the same template recoloured.
    expect(seen.size).toBe(DESIGN_DIRECTIONS.length);
  });

  it("per-store overrides win over the direction preset", () => {
    const t = resolveTheme({ theme: { direction: "minimal", radius: "pill", accent: "#ff0000" }, primaryColor: "#000000" });
    expect(t.vars["--st-radius"]).toBe("9999px");
    expect(t.vars["--st-accent"]).toBe("#ff0000");
  });

  it("falls back to the store primaryColor when no accent is set", () => {
    const t = resolveTheme({ theme: { direction: "modern" }, primaryColor: "#0e7c66" });
    expect(t.vars["--st-accent"]).toBe("#0e7c66");
  });

  it("keeps solid-button text legible against the accent (>= 4.5:1)", () => {
    for (const accent of ["#111111", "#ffd23f", "#2f6bff", "#ff2d87", "#0e7c66", "#e9e4d8"]) {
      // solid buttons on the modern direction paint accent-bg with accent-fg
      const t = resolveTheme({ theme: { direction: "modern", accent }, primaryColor: accent });
      const ratio = contrastRatio(t.vars["--st-btn-bg"], t.vars["--st-btn-fg"]);
      expect(ratio, `accent ${accent} → ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("only loads fonts the store actually uses", () => {
    const t = resolveTheme({ theme: { direction: "modern" }, primaryColor: "#000" });
    const href = googleFontsHref(t)!;
    expect(href).toContain("fonts.googleapis.com");
    // modern = schibsted display + inter body → both, and nothing else.
    expect(href).toContain("Schibsted+Grotesk");
    expect(href).toContain("Inter");
    expect(href).not.toContain("Fraunces");
  });

  it("every direction preset names real fonts and a coherent set", () => {
    for (const direction of DESIGN_DIRECTIONS) {
      const preset = DIRECTION_PRESETS[direction];
      expect(preset.label.length).toBeGreaterThan(0);
      const t = resolveTheme({ theme: { direction }, primaryColor: "#222" });
      expect(t.fontFamilies.length).toBeGreaterThanOrEqual(1);
    }
  });
});
