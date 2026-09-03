import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import type { ServiceContext } from "@/lib/services/context";
import { storefrontTools } from "@/lib/ai/tools/storefront";
import { designTools } from "@/lib/ai/tools/design";
import { resolveTheme, storeThemeSchema } from "@/lib/storefront/theme";

/**
 * The AI storefront designer manipulates a store's structured theme, never raw
 * code. These tests execute its tools directly (the live model is a separate,
 * credit-gated concern) to prove: a design direction is applied as a real,
 * coordinated theme; a fine-tune merges without losing the rest; the tools are
 * store-scoped; and undo restores the prior look.
 */

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

let ctx: ServiceContext;
let organizationId: string;
let userId: string;

const setDirection = storefrontTools.find((t) => t.name === "set_store_design_direction")!;
const updateDesign = storefrontTools.find((t) => t.name === "update_store_design")!;

beforeAll(async () => {
  const setup = await createTestStore("ai-design");
  ctx = setup.ctx;
  organizationId = setup.organization.id;
  userId = setup.user.id;
});

afterAll(async () => {
  await cleanupTestStore(organizationId, userId);
});

async function storedTheme(storeId: string) {
  const store = await testDb.store.findUniqueOrThrow({ where: { id: storeId }, select: { theme: true } });
  return storeThemeSchema.parse(store.theme ?? {});
}

describe("AI storefront designer tools", () => {
  it("both design tools exist and require storefront:write", () => {
    expect(setDirection.capability).toBe("storefront:write");
    expect(updateDesign.capability).toBe("storefront:write");
    // High-impact by design: they always confirm before restyling a live store.
    expect(setDirection.risk).toBe("high");
    expect(updateDesign.risk).toBe("high");
    expect(setDirection.confirm).toBeTypeOf("function");
  });

  it("applies a design direction as a coordinated theme", async () => {
    const result = await setDirection.execute({ direction: "luxury", accent: "#8a6d3b" }, ctx);
    expect(result.summary).toMatch(/luxury/i);
    const theme = await storedTheme(ctx.storeId);
    expect(theme.direction).toBe("luxury");
    expect(theme.accent).toBe("#8a6d3b");
    // Resolves to visibly luxury tokens (serif display, sharp corners).
    const resolved = resolveTheme({ theme, primaryColor: "#000" });
    expect(resolved.vars["--st-font-display"]).toMatch(/Cormorant/);
    expect(resolved.vars["--st-radius"]).toBe("0px");
  });

  it("fine-tunes individual tokens without discarding the direction", async () => {
    await setDirection.execute({ direction: "minimal" }, ctx);
    await updateDesign.execute({ radius: "pill", neutral: "warm" }, ctx);
    const theme = await storedTheme(ctx.storeId);
    expect(theme.direction).toBe("minimal"); // still minimal
    expect(theme.radius).toBe("pill"); // but nudged
    expect(theme.neutral).toBe("warm");
  });

  it("switching direction resets stale token overrides", async () => {
    await updateDesign.execute({ radius: "pill" }, ctx);
    await setDirection.execute({ direction: "technical" }, ctx);
    const theme = await storedTheme(ctx.storeId);
    // The pill override from the old look must not bleed into the new direction.
    expect(theme.radius).toBeUndefined();
    expect(theme.direction).toBe("technical");
  });

  it("is store-scoped — cannot touch another store", async () => {
    const other = await createTestStore("ai-design-other");
    await setDirection.execute({ direction: "bold" }, ctx);
    const otherTheme = await storedTheme(other.store.id);
    expect(otherTheme.direction).toBe("modern"); // untouched default
    await cleanupTestStore(other.organization.id, other.user.id);
  });

  it("returns an undo that restores the previous look", async () => {
    await setDirection.execute({ direction: "playful" }, ctx);
    const before = await storedTheme(ctx.storeId);
    const result = await setDirection.execute({ direction: "editorial" }, ctx);
    expect((await storedTheme(ctx.storeId)).direction).toBe("editorial");
    // A direction switch snapshots first; its undo restores that snapshot.
    expect(result.undo?.tool).toBe("restore_design_snapshot");
    const restore = designTools.find((t) => t.name === "restore_design_snapshot")!;
    await restore.execute(result.undo!.params as never, ctx);
    expect((await storedTheme(ctx.storeId)).direction).toBe(before.direction);
  });
});
