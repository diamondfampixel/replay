import { isPremiumSection } from "@/lib/storefront/sections";
import { PREMIUM_PRODUCT_LAYOUTS } from "@/lib/storefront/theme";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { ensureHomepage } from "@/lib/services/provision";
import type { ServiceContext } from "@/lib/services/context";
import { THEME_CATALOG, THEME_PRICES_CENTS, getCatalogTheme, themePriceCents } from "@/lib/storefront/themes";
import { resolveTheme, storeThemeSchema } from "@/lib/storefront/theme";
import { composeFromRecipe, type ComposeBrief } from "@/lib/storefront/compose";
import { SECTION_META, sectionSchemas } from "@/lib/storefront/sections";
import { applyTheme, isThemeEntitled, listThemes, recordThemePurchase, renderThemeForStore } from "@/lib/services/themes";
import { listDesignSnapshots, restoreDesignSnapshot } from "@/lib/services/snapshots";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const brief: ComposeBrief = { name: "Test Co", description: "A small brand that makes a few things well.", industry: "Goods", catalog: { productCount: 6, collectionSlugs: ["a", "b"], featuredProductId: "p", hasReviews: true } };

describe("theme catalogue", () => {
  it("ships a strong included library and a separate premium tier at the agreed prices", () => {
    const included = THEME_CATALOG.filter((t) => t.tier === "included");
    const premium = THEME_CATALOG.filter((t) => t.tier !== "included");
    expect(included.length).toBeGreaterThanOrEqual(16);
    expect(premium.length).toBeGreaterThanOrEqual(5);
    expect(THEME_PRICES_CENTS).toEqual({ included: 0, standard: 500, premium: 1000, highend: 1500 });
    for (const t of premium) expect(themePriceCents(t)).toBeGreaterThan(0);
    expect(new Set(THEME_CATALOG.map((t) => t.id)).size).toBe(THEME_CATALOG.length);
  });

  it("every theme is a valid structured theme with a recipe that composes into valid sections", () => {
    for (const t of THEME_CATALOG) {
      const parsed = storeThemeSchema.safeParse(t.theme);
      expect(parsed.success, `${t.id}: ${parsed.success ? "" : parsed.error.message}`).toBe(true);
      const resolved = resolveTheme({ theme: t.theme, primaryColor: t.theme.accent ?? "#111111" });
      const sections = composeFromRecipe(resolved, brief, t.recipe);
      expect(sections.length, t.id).toBeGreaterThanOrEqual(5);
      expect(["hero", "imageHero", "videoHero", "announcement", "collectionHero"]).toContain(sections[0].type);
      for (const s of sections) {
        const ok = sectionSchemas[s.type].safeParse(s.config);
        expect(ok.success, `${t.id}/${s.type}: ${ok.success ? "" : ok.error.message}`).toBe(true);
        if (typeof s.config.layout === "string" && SECTION_META[s.type].layouts) expect(SECTION_META[s.type].layouts!.map((l) => l.id)).toContain(s.config.layout);
        const design = s.config.design as { scheme: string; customScheme: string };
        if (design.scheme === "custom") expect((t.theme.schemes ?? []).map((x) => x.id)).toContain(design.customScheme);
      }
    }
  });

  it("themes are genuinely different: no two share the same structural signature", () => {
    const signatures = THEME_CATALOG.map((t) => {
      const resolved = resolveTheme({ theme: t.theme, primaryColor: t.theme.accent ?? "#111111" });
      return `${resolved.fontDisplay}|${resolved.header.style}|${resolved.product.layout}|${t.recipe.map((s) => `${s.type}:${s.layout ?? ""}`).join(">")}`;
    });
    expect(new Set(signatures).size).toBe(THEME_CATALOG.length);
    // The section sequences themselves are distinct across the whole library.
    const sequences = THEME_CATALOG.map((t) => t.recipe.map((s) => `${s.type}:${s.layout ?? ""}`).join(">"));
    expect(new Set(sequences).size).toBe(THEME_CATALOG.length);
    // At least eight different display faces and six different hero compositions are in play.
    expect(new Set(THEME_CATALOG.map((t) => resolveTheme({ theme: t.theme, primaryColor: "#111" }).fontDisplay)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(THEME_CATALOG.map((t) => t.recipe.find((s) => s.type === "hero")?.layout ?? t.recipe[0].type)).size).toBeGreaterThanOrEqual(6);
  });

  it("every premium theme is structurally out of reach of an included one", () => {
    const included = THEME_CATALOG.filter((t) => t.tier === "included");
    const premium = THEME_CATALOG.filter((t) => t.tier !== "included");
    for (const t of premium) {
      const premiumSections = t.recipe.filter((slot) => isPremiumSection(slot.type));
      expect(premiumSections.length, `${t.id} must use at least one premium-only section`).toBeGreaterThanOrEqual(1);
    }
    for (const t of included) {
      expect(t.recipe.some((slot) => isPremiumSection(slot.type)), `${t.id} must not use premium-only sections`).toBe(false);
      expect((PREMIUM_PRODUCT_LAYOUTS as readonly string[]).includes(t.theme.product?.layout ?? ""), `${t.id} must not use a premium product layout`).toBe(false);
    }
    // The "change a few settings" test: no included recipe's section/layout sequence equals any premium one.
    const signature = (t: (typeof THEME_CATALOG)[number]) => t.recipe.map((slot) => `${slot.type}/${slot.layout ?? ""}`).join(">");
    for (const p of premium) for (const i of included) expect(signature(p), `${p.id} vs ${i.id}`).not.toBe(signature(i));
  });

  it("a premium lookbook is seeded from the merchant's own product photos, never invented ones", async () => {
    const { renderThemeForStore } = await import("@/lib/services/themes");
    const { getCatalogTheme } = await import("@/lib/storefront/themes");
    const { createProduct } = await import("@/lib/services/products");
    const own = await createTestStore("themes-lookbook");
    const product = await createProduct(own.ctx, { title: "Lookbook Tee", price: 30, status: "ACTIVE" });
    await testDb.productImage.create({ data: { productId: product.id, url: "/uploads/test/lookbook-tee.png", alt: "Tee on a rail", position: 0 } });
    const { sections } = await renderThemeForStore(own.ctx.storeId, getCatalogTheme("maison")!);
    await cleanupTestStore(own.organization.id, own.user.id);
    const lookbook = sections.find((s) => s.type === "lookbook");
    expect(lookbook).toBeTruthy();
    const items = (lookbook!.config.items as Array<{ media: { url: string }; productSlug: string; caption: string }>);
    expect(items.some((i) => i.media.url === "/uploads/test/lookbook-tee.png" && i.productSlug === product.slug && i.caption === "Lookbook Tee")).toBe(true);
  });

  it("premium themes carry more than a recolour: custom schemes or a richer composition", () => {
    for (const t of THEME_CATALOG.filter((x) => x.tier !== "included")) {
      const richer = (t.theme.schemes?.length ?? 0) >= 1 || t.recipe.length >= 7;
      expect(richer, t.id).toBe(true);
    }
  });
});

describe("theme service", () => {
  let ctx: ServiceContext; let other: ServiceContext;
  const cleanup: Array<[string, string]> = [];
  beforeAll(async () => {
    const a = await createTestStore("themes-a"); const b = await createTestStore("themes-b");
    ctx = a.ctx; other = b.ctx;
    cleanup.push([a.organization.id, a.user.id], [b.organization.id, b.user.id]);
    await ensureHomepage(testDb, ctx.storeId);
    await testDb.product.create({ data: { storeId: ctx.storeId, title: "Widget", slug: "widget", status: "ACTIVE", price: 10, inventory: 5 } });
  });
  afterAll(async () => { for (const [o, u] of cleanup) await cleanupTestStore(o, u); });

  it("lists every theme with ownership and active state", async () => {
    const list = await listThemes(ctx);
    expect(list.length).toBe(THEME_CATALOG.length);
    expect(list.filter((t) => t.tier === "included").every((t) => t.owned)).toBe(true);
    expect(list.filter((t) => t.tier !== "included").every((t) => !t.owned)).toBe(true);
    expect(list.some((t) => t.active)).toBe(false);
  });

  it("renders a theme for a store without writing anything", async () => {
    const before = await testDb.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { theme: true } });
    const { resolved, sections } = await renderThemeForStore(ctx.storeId, getCatalogTheme("blackout")!);
    expect(resolved.direction).toBe("bold");
    expect(sections.some((s) => s.type === "featuredProducts")).toBe(true);
    const after = await testDb.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { theme: true } });
    expect(after.theme).toEqual(before.theme);
  });

  it("applies an included theme with a snapshot first, and the snapshot restores the old design", async () => {
    const hero = await testDb.pageSection.findFirstOrThrow({ where: { page: { storeId: ctx.storeId, type: "HOME" }, type: "hero" } });
    await testDb.pageSection.update({ where: { id: hero.id }, data: { config: { ...(hero.config as object), headline: "Original headline", media: { url: "/keep.png", alt: "", focalX: 50, focalY: 50, overlay: 0, mobileUrl: null } } } });
    const result = await applyTheme(ctx, "sherbet");
    expect(result.sections).toBeGreaterThan(4);
    const store = await testDb.store.findUniqueOrThrow({ where: { id: ctx.storeId } });
    expect(store.activeThemeId).toBe("sherbet");
    expect(storeThemeSchema.parse(store.theme).direction).toBe("playful");
    const sections = await testDb.pageSection.findMany({ where: { page: { storeId: ctx.storeId, type: "HOME" } }, orderBy: { position: "asc" } });
    expect(sections.map((s) => s.type)).toContain("marquee");
    // Merchant media carried into the new hero.
    const newHero = sections.find((s) => s.type === "hero")!;
    expect((newHero.config as { media: { url: string } }).media.url).toBe("/keep.png");
    // Snapshot exists and restores the pre-theme homepage.
    const snap = (await listDesignSnapshots(ctx)).find((s) => s.label.includes("Before applying"));
    expect(snap).toBeDefined();
    await restoreDesignSnapshot(ctx, snap!.id);
    const restored = await testDb.pageSection.findFirst({ where: { page: { storeId: ctx.storeId, type: "HOME" }, type: "hero" } });
    expect((restored!.config as { headline: string }).headline).toBe("Original headline");
  });

  it("refuses a premium theme until a purchase is recorded, and purchases are org-scoped + idempotent", async () => {
    const monolith = getCatalogTheme("monolith")!;
    await expect(applyTheme(ctx, "monolith")).rejects.toThrow(/premium theme/i);
    expect(await isThemeEntitled(ctx.organizationId, monolith)).toBe(false);
    const p1 = await recordThemePurchase({ organizationId: ctx.organizationId, themeId: "monolith", amountCents: 1500, stripeSessionId: "cs_test_1" });
    const p2 = await recordThemePurchase({ organizationId: ctx.organizationId, themeId: "monolith", amountCents: 1500, stripeSessionId: "cs_test_1" });
    expect(p2.id).toBe(p1.id);
    expect(await isThemeEntitled(ctx.organizationId, monolith)).toBe(true);
    expect(await isThemeEntitled(other.organizationId, monolith)).toBe(false);
    await expect(applyTheme(other, "monolith")).rejects.toThrow(/premium theme/i);
    const applied = await applyTheme(ctx, "monolith");
    expect(applied.theme.id).toBe("monolith");
    expect((await listThemes(ctx)).find((t) => t.id === "monolith")).toMatchObject({ owned: true, active: true });
    await expect(recordThemePurchase({ organizationId: ctx.organizationId, themeId: "nope", amountCents: 1 })).rejects.toThrow();
  });

  it("requires storefront:write to apply", async () => {
    await expect(applyTheme({ ...ctx, role: "ANALYST" }, "northline")).rejects.toThrow();
  });
});
