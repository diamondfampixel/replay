import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { ensureHomepage } from "@/lib/services/provision";
import { createDesignSnapshot, deleteDesignSnapshot, listDesignSnapshots, restoreDesignSnapshot } from "@/lib/services/snapshots";
import { applyStoreTheme, getStoreTheme } from "@/lib/storefront/design";
import type { ServiceContext } from "@/lib/services/context";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

let ctx: ServiceContext;
let other: ServiceContext;
const cleanup: Array<[string, string]> = [];
let pageId: string;

beforeAll(async () => {
  const a = await createTestStore("snap-a");
  const b = await createTestStore("snap-b");
  ctx = a.ctx; other = b.ctx;
  cleanup.push([a.organization.id, a.user.id], [b.organization.id, b.user.id]);
  pageId = (await ensureHomepage(testDb, ctx.storeId)).id;
  await ensureHomepage(testDb, other.storeId);
});
afterAll(async () => { for (const [o, u] of cleanup) await cleanupTestStore(o, u); });

describe("design snapshots", () => {
  it("captures theme + sections and restores them after a redesign, reversibly", async () => {
    await applyStoreTheme(ctx.storeId, { direction: "editorial" });
    const before = await testDb.pageSection.findMany({ where: { pageId }, orderBy: { position: "asc" } });
    const snap = await createDesignSnapshot(ctx, { label: "Editorial look", source: "manual" });
    expect(snap.pageCount).toBe(1);

    // A "redesign": new direction, sections wiped.
    await applyStoreTheme(ctx.storeId, { direction: "bold" });
    await testDb.pageSection.deleteMany({ where: { pageId } });
    expect((await getStoreTheme(ctx.storeId)).direction).toBe("bold");

    const result = await restoreDesignSnapshot(ctx, snap.id);
    expect(result.restoredPages).toBe(1);
    expect((await getStoreTheme(ctx.storeId)).direction).toBe("editorial");
    const after = await testDb.pageSection.findMany({ where: { pageId }, orderBy: { position: "asc" } });
    expect(after.map((s) => s.type)).toEqual(before.map((s) => s.type));

    // The restore itself took an automatic snapshot of the "bold" state.
    const list = await listDesignSnapshots(ctx);
    const auto = list.find((s) => s.source === "auto");
    expect(auto?.label).toContain("Before restoring");
    await restoreDesignSnapshot(ctx, auto!.id);
    expect((await getStoreTheme(ctx.storeId)).direction).toBe("bold");
  });

  it("is strictly store-scoped: another tenant cannot list, restore or delete", async () => {
    const snap = await createDesignSnapshot(ctx, { label: "Mine" });
    const theirs = await listDesignSnapshots(other);
    expect(theirs.find((s) => s.id === snap.id)).toBeUndefined();
    await expect(restoreDesignSnapshot(other, snap.id)).rejects.toThrow(/not found/i);
    await expect(deleteDesignSnapshot(other, snap.id)).rejects.toThrow(/not found/i);
    // Still there for the owner.
    expect((await listDesignSnapshots(ctx)).some((s) => s.id === snap.id)).toBe(true);
    await deleteDesignSnapshot(ctx, snap.id);
    expect((await listDesignSnapshots(ctx)).some((s) => s.id === snap.id)).toBe(false);
  });

  it("refuses without storefront:write", async () => {
    await expect(createDesignSnapshot({ ...ctx, role: "ANALYST" }, { label: "x" })).rejects.toThrow();
  });
});
