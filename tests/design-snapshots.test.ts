import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { ensureHomepage } from "@/lib/services/provision";
import { createDesignSnapshot, deleteDesignSnapshot, listDesignSnapshots, restoreDesignSnapshot, snapshotLimitFor } from "@/lib/services/snapshots";
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

  it("keeps a rolling count per plan and recycles automatic snapshots before manual ones", async () => {
    // Free plan keeps 5. Start clean.
    await testDb.designSnapshot.deleteMany({ where: { storeId: ctx.storeId } });
    await testDb.organization.update({ where: { id: ctx.organizationId }, data: { plan: "harbor" } });
    expect(await snapshotLimitFor(ctx.storeId)).toBe(5);
    const keep = await createDesignSnapshot(ctx, { label: "Keep me", source: "manual" });
    for (let i = 0; i < 4; i += 1) await createDesignSnapshot(ctx, { label: `auto ${i}`, source: "auto" });
    expect((await listDesignSnapshots(ctx)).length).toBe(5);
    // The sixth pushes out the oldest automatic one — not the manual one.
    await createDesignSnapshot(ctx, { label: "auto 4", source: "auto" });
    const after = await listDesignSnapshots(ctx);
    expect(after.length).toBe(5);
    expect(after.some((s) => s.id === keep.id)).toBe(true);
    expect(after.some((s) => s.label === "auto 0")).toBe(false);
    // Upgrading raises the ceiling; downgrading prunes on the next write.
    await testDb.organization.update({ where: { id: ctx.organizationId }, data: { plan: "skiff" } });
    expect(await snapshotLimitFor(ctx.storeId)).toBe(20);
    await testDb.organization.update({ where: { id: ctx.organizationId }, data: { plan: "clipper" } });
    expect(await snapshotLimitFor(ctx.storeId)).toBe(50);
    await testDb.organization.update({ where: { id: ctx.organizationId }, data: { plan: "flagship" } });
    expect(await snapshotLimitFor(ctx.storeId)).toBe(100);
    await testDb.organization.update({ where: { id: ctx.organizationId }, data: { plan: "harbor" } });
    for (let i = 0; i < 3; i += 1) await createDesignSnapshot(ctx, { label: `more ${i}`, source: "ai" });
    expect((await listDesignSnapshots(ctx)).length).toBe(5);
    expect((await listDesignSnapshots(ctx)).some((s) => s.id === keep.id)).toBe(true);
    await testDb.organization.update({ where: { id: ctx.organizationId }, data: { plan: "flagship" } });
  });

  it("refuses without storefront:write", async () => {
    await expect(createDesignSnapshot({ ...ctx, role: "ANALYST" }, { label: "x" })).rejects.toThrow();
  });
});
