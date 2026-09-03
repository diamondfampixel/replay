import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { ensureHomepage } from "@/lib/services/provision";
import { getEditablePage } from "@/lib/services/pages";
import { designTools } from "@/lib/ai/tools/design";
import { storefrontTools } from "@/lib/ai/tools/storefront";
import { getTool, toolsForRole } from "@/lib/ai/registry";
import { resolveTheme, storeThemeSchema } from "@/lib/storefront/theme";
import type { ServiceContext } from "@/lib/services/context";

/**
 * The v2 AI designer works on structured design data: DNA, compositions,
 * per-section design, whole-page composition — and every broad change is
 * reversible through a snapshot. The live model is a separate, credit-gated
 * concern; these tests execute the tools directly.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

let ctx: ServiceContext;
let other: ServiceContext;
const cleanup: Array<[string, string]> = [];
let pageId: string;

const tool = (name: string) => [...designTools, ...storefrontTools].find((t) => t.name === name)!;
const run = <T = Record<string, unknown>>(name: string, input: unknown, c: ServiceContext = ctx) =>
  tool(name).execute(tool(name).schema.parse(input) as never, c as never) as Promise<{ summary: string; data: T; undo?: { tool: string; params: Record<string, unknown> } }>;

async function theme(storeId: string) {
  const store = await testDb.store.findUniqueOrThrow({ where: { id: storeId }, select: { theme: true, primaryColor: true } });
  return resolveTheme({ theme: store.theme, primaryColor: store.primaryColor });
}

beforeAll(async () => {
  const a = await createTestStore("designer-a");
  const b = await createTestStore("designer-b");
  ctx = a.ctx; other = b.ctx;
  cleanup.push([a.organization.id, a.user.id], [b.organization.id, b.user.id]);
  pageId = (await ensureHomepage(testDb, ctx.storeId)).id;
  await testDb.collection.create({ data: { storeId: ctx.storeId, title: "Essentials", slug: "essentials", type: "AUTOMATIC" } });
});
afterAll(async () => { for (const [o, u] of cleanup) await cleanupTestStore(o, u); });

describe("AI designer v2", () => {
  it("registers the design tools for operators", () => {
    const names = toolsForRole("OWNER").map((t) => t.name);
    for (const n of ["get_design_context", "update_design_dna", "set_section_composition", "set_section_design", "compose_page", "create_design_snapshot", "restore_design_snapshot"]) {
      expect(names).toContain(n);
      expect(getTool(n)).toBeDefined();
    }
  });

  it("get_design_context describes the whole design and the vocabularies", async () => {
    const result = await run<{ dna: Record<string, number>; homepage: { sections: Array<{ layout: string | null }> }; vocabulary: { sections: Record<string, { layouts: string[] }> } }>("get_design_context", {});
    expect(result.data.dna.expression).toBeTypeOf("number");
    expect(result.data.homepage.sections.length).toBeGreaterThan(0);
    expect(result.data.vocabulary.sections.hero.layouts).toContain("asymmetric");
  });

  it("update_design_dna bends the character, snapshots first, and undo restores it", async () => {
    const before = await theme(ctx.storeId);
    const result = await run<{ dna: Record<string, number>; snapshotId: string }>("update_design_dna", { moves: [{ move: "premium" }] });
    const after = await theme(ctx.storeId);
    expect(after.dna.tone).toBeLessThan(before.dna.tone);
    expect(after.dna.density).toBeLessThan(before.dna.density);
    expect(result.undo).toEqual({ tool: "restore_design_snapshot", params: { snapshotId: result.data.snapshotId } });
    await run("restore_design_snapshot", result.undo!.params);
    expect((await theme(ctx.storeId)).dna).toEqual(before.dna);
  });

  it("set_section_composition and set_section_design change one section and validate the vocabulary", async () => {
    const hero = await testDb.pageSection.findFirstOrThrow({ where: { pageId, type: "hero" } });
    await run("set_section_composition", { sectionId: hero.id, layout: "editorial" });
    await expect(run("set_section_composition", { sectionId: hero.id, layout: "nope" })).rejects.toThrow(/not a valid composition/);
    const restyled = await run<{ design: { scheme: string; paddingTop: string } }>("set_section_design", { sectionId: hero.id, design: { scheme: "contrast", paddingTop: "xl" } });
    expect(restyled.data.design).toMatchObject({ scheme: "contrast", paddingTop: "xl" });
    const stored = await testDb.pageSection.findUniqueOrThrow({ where: { id: hero.id } });
    const config = stored.config as { layout: string; design: { scheme: string }; headline: string };
    expect(config.layout).toBe("editorial");
    expect(config.design.scheme).toBe("contrast");
    expect(config.headline).toBeTruthy(); // content untouched
  });

  it("compose_page stages a draft (never live), snapshots first, and confirm shows the plan", async () => {
    const liveBefore = await testDb.pageSection.findMany({ where: { pageId } });
    const confirmation = await tool("compose_page").confirm!({ page: "homepage", goal: "launch", tagline: "Built for after dark", facts: { benefits: [{ title: "Free returns", body: "60 days" }] } } as never, ctx as never);
    expect(confirmation.details?.join("\n")).toMatch(/Hero/);
    const result = await run<{ pageId: string; snapshotId: string; sections: string[] }>("compose_page", { goal: "launch", tagline: "Built for after dark", facts: { benefits: [{ title: "Free returns", body: "60 days" }] } });
    expect(result.data.sections.length).toBeGreaterThan(3);
    // Live rows are untouched; the draft carries the composition.
    const liveAfter = await testDb.pageSection.findMany({ where: { pageId } });
    expect(liveAfter.map((s) => s.id).sort()).toEqual(liveBefore.map((s) => s.id).sort());
    const editable = await getEditablePage(ctx, pageId);
    expect(editable.hasUnpublishedChanges).toBe(true);
    expect(editable.sections[0].type).toBe("hero");
    expect(editable.sections[0].config.headline).toBe("Built for after dark");
    expect(editable.sections.some((s) => s.type === "testimonials")).toBe(false);
    expect(result.undo?.tool).toBe("restore_design_snapshot");
  });

  it("update_store_design accepts grouped tokens and merges into the stored group", async () => {
    await run("update_store_design", { product: { layout: "stickyInfo" } });
    await run("update_store_design", { product: { blocks: ["title", "price", "quantityBuy"] } });
    const stored = storeThemeSchema.parse((await testDb.store.findUniqueOrThrow({ where: { id: ctx.storeId } })).theme);
    expect(stored.product).toMatchObject({ layout: "stickyInfo", blocks: ["title", "price", "quantityBuy"] });
    expect((await theme(ctx.storeId)).product.layout).toBe("stickyInfo");
  });

  it("tools are store-scoped: another tenant cannot touch this store's sections or snapshots", async () => {
    const hero = await testDb.pageSection.findFirstOrThrow({ where: { pageId, type: "hero" } });
    await expect(run("set_section_composition", { sectionId: hero.id, layout: "center" }, other)).rejects.toThrow();
    const snap = await run<{ snapshotId: string }>("create_design_snapshot", { label: "mine" });
    await expect(run("restore_design_snapshot", { snapshotId: snap.data.snapshotId }, other)).rejects.toThrow(/not found/i);
  });
});
