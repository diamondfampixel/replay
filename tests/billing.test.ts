import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import {
  assertAIWithinBudget, assertCanAddProduct, changePlan, getAIBudget, recordAIUsage,
} from "@/lib/services/billing";
import type { ServiceContext } from "@/lib/services/context";

let ctx: ServiceContext;
let organizationId: string;
let userId: string;

async function setPlan(plan: string) {
  await testDb.organization.update({ where: { id: organizationId }, data: { plan } });
}

beforeAll(async () => {
  const setup = await createTestStore("billing");
  ctx = setup.ctx;
  organizationId = setup.organization.id;
  userId = setup.user.id;
});

afterAll(async () => {
  await cleanupTestStore(organizationId, userId);
});

describe("the free starter allowance", () => {
  it("is one-time: spent across the account's life, never refilled", async () => {
    await setPlan("harbor");
    const fresh = await getAIBudget(organizationId);
    expect(fresh.remaining).toBe(50);

    // Spend it across two different days — a daily reset would forgive this.
    const lastMonth = new Date(Date.UTC(2026, 6, 15));
    await testDb.aIUsageDay.create({
      data: { organizationId, day: lastMonth, actions: 30, inputTokens: 1000, outputTokens: 100 },
    });
    await recordAIUsage(organizationId, { actions: 20, inputTokens: 800, outputTokens: 90 });

    const spent = await getAIBudget(organizationId);
    expect(spent.usedAllTime).toBe(50);
    expect(spent.remaining).toBe(0);
    expect(spent.exhausted).toBe(true);
    await expect(assertAIWithinBudget(organizationId)).rejects.toThrow(/starter AI actions/i);
  });

  it("upgrading unlocks the monthly allowance without erasing history", async () => {
    await setPlan("skiff");
    const budget = await getAIBudget(organizationId);
    // Only this month's 20 actions count against Skiff's 300.
    expect(budget.remaining).toBe(280);
    await expect(assertAIWithinBudget(organizationId)).resolves.toBeTruthy();
  });

  it("a paid plan exhausts monthly, with an upgrade-facing message", async () => {
    await setPlan("skiff");
    await recordAIUsage(organizationId, { actions: 280 });
    await expect(assertAIWithinBudget(organizationId)).rejects.toThrow(/this month's 300/i);
    await testDb.aIUsageDay.deleteMany({ where: { organizationId } });
    await setPlan("flagship");
  });
});

describe("metering", () => {
  it("accumulates actions and exact token counts per day", async () => {
    await recordAIUsage(organizationId, { actions: 1, inputTokens: 9000, outputTokens: 400, cacheReadTokens: 7000 });
    await recordAIUsage(organizationId, { actions: 1, inputTokens: 2000, outputTokens: 300, cacheReadTokens: 8000 });

    const rows = await testDb.aIUsageDay.findMany({ where: { organizationId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].actions).toBe(2);
    expect(rows[0].inputTokens).toBe(11000);
    expect(rows[0].outputTokens).toBe(700);
    expect(rows[0].cacheReadTokens).toBe(15000);
    await testDb.aIUsageDay.deleteMany({ where: { organizationId } });
  });
});

describe("plan gates", () => {
  it("caps the Harbor catalog at 50 products, and upgrade lifts it", async () => {
    await setPlan("harbor");
    // 50 products already? The fixture store starts empty; simulate the cap.
    const existing = await testDb.product.count({ where: { storeId: ctx.storeId } });
    const toCreate = 50 - existing;
    await testDb.product.createMany({
      data: Array.from({ length: toCreate }, (_, i) => ({
        storeId: ctx.storeId,
        title: `Filler ${i}`,
        slug: `filler-${i}`,
        price: 10,
        status: "DRAFT" as const,
      })),
    });

    await expect(assertCanAddProduct(ctx)).rejects.toThrow(/50 products/i);
    await setPlan("flagship");
    await expect(assertCanAddProduct(ctx)).resolves.toBeUndefined();
    await testDb.product.deleteMany({ where: { storeId: ctx.storeId, title: { startsWith: "Filler" } } });
  });

  it("refuses a downgrade while usage exceeds the target plan, naming the fix", async () => {
    await setPlan("flagship");
    const second = await testDb.user.create({
      data: { email: `billing-second-${Date.now()}@example.test`, name: "Second", passwordHash: "x" },
    });
    await testDb.membership.create({
      data: { userId: second.id, organizationId, role: "SUPPORT" },
    });

    // Harbor allows 1 member; we now have 2.
    await expect(changePlan(ctx, "harbor")).rejects.toThrow(/remove 1 team member/i);

    await testDb.membership.deleteMany({ where: { userId: second.id } });
    await testDb.user.delete({ where: { id: second.id } });

    const org = await changePlan(ctx, "harbor");
    expect(org.plan).toBe("harbor");
    await setPlan("flagship");
  });

  it("only billing:manage can change the plan", async () => {
    await expect(changePlan({ ...ctx, role: "ADMIN" }, "clipper")).rejects.toThrow(/billing:manage/);
  });
});
