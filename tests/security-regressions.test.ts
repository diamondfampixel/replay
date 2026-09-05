import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { createExperiment } from "@/lib/services/experiments";
import { upsertCustomerAddress, createCustomer } from "@/lib/services/customers";
import { sanitizeCustomCss } from "@/lib/storefront/custom-css";
import { isSameOriginRequest } from "@/lib/request-origin";
import { ensureHomepage } from "@/lib/services/provision";
import { createProduct } from "@/lib/services/products";
import type { ServiceContext } from "@/lib/services/context";

let a: { ctx: ServiceContext; organizationId: string; userId: string };
let b: { ctx: ServiceContext; organizationId: string; userId: string };

beforeAll(async () => {
  const one = await createTestStore("sec-a");
  const two = await createTestStore("sec-b");
  a = { ctx: one.ctx, organizationId: one.organization.id, userId: one.user.id };
  b = { ctx: two.ctx, organizationId: two.organization.id, userId: two.user.id };
  await ensureHomepage(testDb, a.ctx.storeId);
  await ensureHomepage(testDb, b.ctx.storeId);
});

afterAll(async () => {
  await cleanupTestStore(a.organizationId, a.userId);
  await cleanupTestStore(b.organizationId, b.userId);
});

describe("cross-tenant targets are refused", () => {
  it("an experiment cannot be aimed at another store's product, page or section", async () => {
    const product = await createProduct(a.ctx, { title: "Owned by A", price: 10, status: "ACTIVE" });
    const page = await testDb.page.findFirstOrThrow({ where: { storeId: a.ctx.storeId, type: "HOME" }, include: { sections: true } });
    const variants = [
      { name: "A", isControl: true, weight: 50, changes: {} },
      { name: "B", isControl: false, weight: 50, changes: { title: "Hijacked" } },
    ];
    await expect(
      createExperiment(b.ctx, { name: "x", testType: "product_title", targetType: "product", productId: product.id, goal: "purchase", variants } as never),
    ).rejects.toThrow(/Product not found/);
    await expect(
      createExperiment(b.ctx, { name: "x", testType: "headline", targetType: "page", pageId: page.id, sectionId: page.sections[0]?.id, goal: "purchase", variants } as never),
    ).rejects.toThrow(/not found/);
    const untouched = await testDb.product.findUnique({ where: { id: product.id } });
    expect(untouched?.title).toBe("Owned by A");
  });

  it("an address can only be edited through its own customer", async () => {
    const customerA = await createCustomer(a.ctx, { email: `a-${Date.now()}@example.test`, firstName: "A", lastName: "One" } as never);
    const address = await upsertCustomerAddress(a.ctx, customerA.id, { name: "A One", line1: "1 Main St", city: "Town", region: "CA", postalCode: "90001", country: "US" });
    const customerB = await createCustomer(b.ctx, { email: `b-${Date.now()}@example.test`, firstName: "B", lastName: "Two" } as never);
    await expect(
      upsertCustomerAddress(b.ctx, customerB.id, { name: "Evil", line1: "EVIL", city: "X", region: "Y", postalCode: "1", country: "US" }, address.id),
    ).rejects.toThrow(/Address not found/);
    const still = await testDb.address.findUnique({ where: { id: address.id } });
    expect(still?.line1).toBe("1 Main St");
  });
});

describe("custom CSS containment", () => {
  it("a brace hidden in a comment cannot escape the storefront scope", () => {
    const { css } = sanitizeCustomCss("/* { */ } body { display:none } .x { color: red }");
    // Everything must still sit inside the single wrapper; no top-level rule may follow a stray brace.
    expect(css.startsWith(".st-root {")).toBe(true);
    const inner = css.slice(".st-root {".length, css.lastIndexOf("}"));
    let depth = 0;
    for (const ch of inner) {
      if (ch === "{") depth += 1;
      if (ch === "}") depth -= 1;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(css).not.toMatch(/\}\s*body\s*\{/);
  });
});

describe("same-origin guard for cookie-authenticated routes", () => {
  const make = (headers: Record<string, string>) => new Request("https://app.halyard.example/api/admin/media", { method: "POST", headers });
  it("accepts same-origin and header-less requests, refuses cross-site ones", () => {
    expect(isSameOriginRequest(make({ host: "app.halyard.example", origin: "https://app.halyard.example" }))).toBe(true);
    expect(isSameOriginRequest(make({ host: "app.halyard.example" }))).toBe(true);
    expect(isSameOriginRequest(make({ host: "app.halyard.example", origin: "https://evil.example", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(make({ host: "app.halyard.example", origin: "https://evil.example" }))).toBe(false);
    expect(isSameOriginRequest(make({ host: "app.halyard.example", "sec-fetch-site": "same-origin" }))).toBe(true);
  });
});
