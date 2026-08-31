import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import {
  createCategory, deleteCategory, listCategories, updateCategory,
} from "@/lib/services/categories";
import type { ServiceContext } from "@/lib/services/context";

let ctx: ServiceContext;
let organizationId: string;
let userId: string;

let other: Awaited<ReturnType<typeof createTestStore>>;

beforeAll(async () => {
  const setup = await createTestStore("categories");
  ctx = setup.ctx;
  organizationId = setup.organization.id;
  userId = setup.user.id;
  other = await createTestStore("categories-other");
});

afterAll(async () => {
  await cleanupTestStore(other.organization.id, other.user.id);
  await cleanupTestStore(organizationId, userId);
});

describe("category tree", () => {
  it("nests children under their parent", async () => {
    const parent = await createCategory(ctx, { name: "Apparel" });
    const child = await createCategory(ctx, { name: "Knitwear", parentId: parent.id });

    const tree = await listCategories(ctx);
    const node = tree.find((n) => n.id === parent.id);
    expect(node?.children.map((c) => c.id)).toContain(child.id);

    await deleteCategory(ctx, child.id);
    await deleteCategory(ctx, parent.id);
  });

  it("refuses to make a category its own parent or build a cycle", async () => {
    const a = await createCategory(ctx, { name: "Cycle A" });
    const b = await createCategory(ctx, { name: "Cycle B", parentId: a.id });

    await expect(updateCategory(ctx, a.id, { parentId: a.id })).rejects.toThrow(/own parent/i);
    await expect(updateCategory(ctx, a.id, { parentId: b.id })).rejects.toThrow(/circular/i);

    await deleteCategory(ctx, b.id);
    await deleteCategory(ctx, a.id);
  });
});

describe("category tenant isolation", () => {
  it("will not adopt a parent from another store, on create or update", async () => {
    const foreign = await createCategory(other.ctx, { name: "Someone else's tree" });
    const mine = await createCategory(ctx, { name: "Mine" });

    // create already refused this; update must too.
    await expect(createCategory(ctx, { name: "Child", parentId: foreign.id })).rejects.toThrow();
    await expect(updateCategory(ctx, mine.id, { parentId: foreign.id })).rejects.toThrow();

    const row = await testDb.category.findUniqueOrThrow({ where: { id: mine.id } });
    expect(row.parentId).toBeNull();

    await deleteCategory(ctx, mine.id);
    await deleteCategory(other.ctx, foreign.id);
  });

  it("will not update or delete a category belonging to another store", async () => {
    const foreign = await createCategory(other.ctx, { name: "Not yours" });

    await expect(updateCategory(ctx, foreign.id, { name: "Renamed" })).rejects.toThrow();
    await expect(deleteCategory(ctx, foreign.id)).rejects.toThrow();

    const row = await testDb.category.findUniqueOrThrow({ where: { id: foreign.id } });
    expect(row.name).toBe("Not yours");

    await deleteCategory(other.ctx, foreign.id);
  });

  it("lists only this store's categories", async () => {
    const mine = await createCategory(ctx, { name: "Visible" });
    const foreign = await createCategory(other.ctx, { name: "Invisible" });

    const ids = (await listCategories(ctx)).map((node) => node.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(foreign.id);

    await deleteCategory(ctx, mine.id);
    await deleteCategory(other.ctx, foreign.id);
  });
});
