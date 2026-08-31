import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore, testDb, analystContext } from "./helpers";
import {
  createProduct, deleteProducts, duplicateProduct, getProduct,
  listProducts, setProductStatus, updateProduct,
} from "@/lib/services/products";
import { AuthorizationError } from "@/lib/permissions";
import type { ServiceContext } from "@/lib/services/context";

let ctx: ServiceContext;
let organizationId: string;
let userId: string;

beforeAll(async () => {
  const setup = await createTestStore("products");
  ctx = setup.ctx;
  organizationId = setup.organization.id;
  userId = setup.user.id;
});

afterAll(async () => {
  await cleanupTestStore(organizationId, userId);
});

describe("product CRUD", () => {
  it("creates a product with images and a variant matrix", async () => {
    const product = await createProduct(ctx, {
      title: "Test Hoodie",
      description: "A hoodie for the test suite.",
      status: "ACTIVE",
      price: 59.99,
      compareAtPrice: 79.99,
      cost: 20,
      sku: "TH-001",
      tags: ["test", "fleece"],
      images: [{ url: "/demo/products/test.svg", alt: "Front" }],
      variants: [
        { title: "Small", options: { Size: "S" }, inventory: 5 },
        { title: "Medium", options: { Size: "M" }, inventory: 7 },
        { title: "Large", options: { Size: "L" }, inventory: 3, price: 64.99 },
      ],
    });

    expect(product.slug).toBe("test-hoodie");
    expect(product.variants).toHaveLength(3);
    // Inventory on a variant product is the sum of its variants.
    const stored = await getProduct(ctx, product.id);
    expect(stored.inventory).toBe(15);
    expect(stored.images).toHaveLength(1);
  });

  it("derives a unique slug when titles collide", async () => {
    const first = await createProduct(ctx, { title: "Duplicate Name", price: 10 });
    const second = await createProduct(ctx, { title: "Duplicate Name", price: 12 });
    expect(first.slug).toBe("duplicate-name");
    expect(second.slug).toBe("duplicate-name-2");
  });

  it("updates fields without touching untouched ones", async () => {
    const product = await createProduct(ctx, {
      title: "Partial Update", price: 25, description: "Original", tags: ["keep"],
    });
    await updateProduct(ctx, product.id, { price: 30 });
    const updated = await getProduct(ctx, product.id);
    expect(Number(updated.price)).toBe(30);
    expect(updated.description).toBe("Original");
    expect(updated.tags).toEqual(["keep"]);
  });

  it("replaces the variant set and recomputes inventory", async () => {
    const product = await createProduct(ctx, {
      title: "Variant Rework",
      price: 40,
      variants: [
        { title: "A", options: { Size: "A" }, inventory: 2 },
        { title: "B", options: { Size: "B" }, inventory: 4 },
      ],
    });
    const created = await getProduct(ctx, product.id);
    expect(created.inventory).toBe(6);

    await updateProduct(ctx, product.id, {
      variants: [
        { id: created.variants[0].id, title: "A", options: { Size: "A" }, inventory: 10 },
      ],
    });
    const updated = await getProduct(ctx, product.id);
    expect(updated.variants).toHaveLength(1);
    expect(updated.inventory).toBe(10);
  });

  it("duplicates as a draft with copied variants", async () => {
    const source = await createProduct(ctx, {
      title: "Copy Me", price: 15, status: "ACTIVE",
      variants: [{ title: "One", options: { Size: "One" }, inventory: 1 }],
    });
    const copy = await duplicateProduct(ctx, source.id);
    const loaded = await getProduct(ctx, copy.id);
    expect(loaded.status).toBe("DRAFT");
    expect(loaded.title).toBe("Copy Me (copy)");
    expect(loaded.variants).toHaveLength(1);
  });

  it("filters, searches and paginates", async () => {
    const bySearch = await listProducts(ctx, { q: "Test Hoodie" });
    expect(bySearch.rows.some((row) => row.title === "Test Hoodie")).toBe(true);

    const drafts = await listProducts(ctx, { status: "DRAFT" });
    expect(drafts.rows.every((row) => row.status === "DRAFT")).toBe(true);

    const paged = await listProducts(ctx, { perPage: 2, page: 1 });
    expect(paged.rows.length).toBeLessThanOrEqual(2);
    expect(paged.pageCount).toBeGreaterThanOrEqual(1);
  });

  it("archives in bulk and deletes", async () => {
    const a = await createProduct(ctx, { title: "Bulk A", price: 5 });
    const b = await createProduct(ctx, { title: "Bulk B", price: 5 });

    const archived = await setProductStatus(ctx, [a.id, b.id], "ARCHIVED");
    expect(archived).toBe(2);

    const deleted = await deleteProducts(ctx, [a.id, b.id]);
    expect(deleted).toBe(2);
    await expect(getProduct(ctx, a.id)).rejects.toThrow();
  });

  it("rejects invalid input before touching the database", async () => {
    await expect(createProduct(ctx, { title: "", price: 10 })).rejects.toThrow();
    await expect(createProduct(ctx, { title: "Negative", price: -5 })).rejects.toThrow();
  });

  it("refuses writes from a read-only role", async () => {
    const analyst = analystContext(ctx);
    await expect(createProduct(analyst, { title: "Blocked", price: 10 })).rejects.toThrow(AuthorizationError);
    // Reads are still allowed.
    await expect(listProducts(analyst, {})).resolves.toBeTruthy();
  });
});

describe("organization isolation", () => {
  it("cannot read a product belonging to another store", async () => {
    const other = await createTestStore("isolation");
    const foreign = await createProduct(other.ctx, { title: "Foreign Product", price: 20 });

    // Same product id, but scoped to the first store's context.
    await expect(getProduct(ctx, foreign.id)).rejects.toThrow(/not found/i);

    const list = await listProducts(ctx, { q: "Foreign Product" });
    expect(list.rows).toHaveLength(0);

    // Bulk operations silently skip rows outside the tenant.
    const affected = await setProductStatus(ctx, [foreign.id], "ARCHIVED");
    expect(affected).toBe(0);
    const stillActive = await testDb.product.findUnique({ where: { id: foreign.id } });
    expect(stillActive?.status).toBe("DRAFT");

    await cleanupTestStore(other.organization.id, other.user.id);
  });
});
