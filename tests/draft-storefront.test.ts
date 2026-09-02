import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import type { ServiceContext } from "@/lib/services/context";

/**
 * A DRAFT store is the operator's private preview. The public must get
 * "not available" (the storefront route 404s), while the signed-in operator
 * can browse it — but still cannot place orders until it goes live. Losing
 * either half of this breaks something real: the first regression dead-ends
 * every new merchant on a 404 of their own store; the second leaks unfinished
 * stores to anyone who guesses the slug.
 */

let ctx: ServiceContext;
let organizationId: string;
let userId: string;
let storeId: string;
let storeSlug: string;
let productId: string;

/** What the mocked session reports; tests flip this between owner and public. */
let activeContext: { storeId: string } | null = null;

vi.mock("@/lib/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/session")>("@/lib/session");
  return { ...actual, getActiveContext: async () => activeContext };
});

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

beforeAll(async () => {
  const setup = await createTestStore("draft-storefront");
  ctx = setup.ctx;
  organizationId = setup.organization.id;
  userId = setup.user.id;
  storeId = setup.store.id;
  storeSlug = setup.store.slug;

  await testDb.store.update({ where: { id: storeId }, data: { status: "DRAFT" } });
  const product = await testDb.product.create({
    data: {
      storeId,
      title: "Draft Test Mug",
      slug: "draft-test-mug",
      status: "ACTIVE",
      price: 24,
      inventory: 10,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await cleanupTestStore(organizationId, userId);
});

describe("draft storefront access", () => {
  it("refuses cart actions for the public as if the store does not exist", async () => {
    activeContext = null;
    const { addToCartAction } = await import("@/app/actions/storefront");
    const result = await addToCartAction(storeSlug, productId, null, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("This store is not available.");
  });

  it("refuses cart actions for a different store's operator the same way", async () => {
    activeContext = { storeId: "some-other-store" };
    const { addToCartAction } = await import("@/app/actions/storefront");
    const result = await addToCartAction(storeSlug, productId, null, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("This store is not available.");
  });

  it("lets the operator past the 404 layer but blocks orders with a draft message", async () => {
    activeContext = { storeId };
    const { addToCartAction } = await import("@/app/actions/storefront");
    const result = await addToCartAction(storeSlug, productId, null, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("still a draft");
  });

  it("accepts orders again once the store is live", async () => {
    await testDb.store.update({ where: { id: storeId }, data: { status: "ACTIVE" } });
    activeContext = null;
    const { addToCartAction } = await import("@/app/actions/storefront");
    const result = await addToCartAction(storeSlug, productId, null, 1);
    expect(result.ok).toBe(true);
  });
});
