import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import {
  assertAIWithinBudget, assertCanAddProduct, changePlan, getAIBudget, recordAIRequest, recordAIUsage,
} from "@/lib/services/billing";
import { PLANS } from "@/lib/plans";
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
    expect(fresh.remaining).toBe(25);

    // Spend it across two different days — a daily reset would forgive this.
    const lastMonth = new Date(Date.UTC(2026, 6, 15));
    await testDb.aIUsageDay.create({
      data: { organizationId, day: lastMonth, actions: 15, inputTokens: 1000, outputTokens: 100 },
    });
    await recordAIUsage(organizationId, { actions: 10, inputTokens: 800, outputTokens: 90 });

    const spent = await getAIBudget(organizationId);
    expect(spent.usedAllTime).toBe(25);
    expect(spent.remaining).toBe(0);
    expect(spent.exhausted).toBe(true);
    await expect(assertAIWithinBudget(organizationId)).rejects.toThrow(/starter AI actions/i);
  });

  it("upgrading unlocks the monthly allowance without erasing history", async () => {
    await setPlan("skiff");
    const budget = await getAIBudget(organizationId);
    // Only this month's 10 actions count against Skiff's 100.
    expect(budget.remaining).toBe(90);
    await expect(assertAIWithinBudget(organizationId)).resolves.toBeTruthy();
  });

  it("a paid plan exhausts monthly, with an upgrade-facing message", async () => {
    await setPlan("skiff");
    await recordAIUsage(organizationId, { actions: 90 });
    await expect(assertAIWithinBudget(organizationId)).rejects.toThrow(/this month's 100/i);
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

describe("allowances by plan", () => {
  const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
  const now = new Date();
  const thisMonth = day(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const lastMonth = day(now.getUTCFullYear(), now.getUTCMonth() - 1, 15);

  it("are the decided numbers: Free 25 lifetime, Skiff 100, Clipper 250, Flagship 600 a month", () => {
    const byId = Object.fromEntries(PLANS.map((plan) => [plan.id, plan.limits]));
    expect(byId.harbor.aiStarterActions).toBe(25);
    expect(byId.harbor.aiActionsPerMonth).toBeNull();
    expect(byId.skiff.aiActionsPerMonth).toBe(100);
    expect(byId.clipper.aiActionsPerMonth).toBe(250);
    expect(byId.flagship.aiActionsPerMonth).toBe(600);
    // Prices untouched.
    expect(PLANS.map((plan) => plan.monthly)).toEqual([0, 19, 49, 129]);
    expect(PLANS.map((plan) => plan.annualMonthly)).toEqual([0, 15, 39, 99]);
  });

  it("monthly plans reset: last month's usage does not count, this month's does", async () => {
    await testDb.aIUsageDay.deleteMany({ where: { organizationId } });
    await testDb.aIUsageDay.create({ data: { organizationId, day: lastMonth, actions: 240 } });
    await setPlan("clipper");
    expect((await getAIBudget(organizationId)).remaining).toBe(250);
    await testDb.aIUsageDay.create({ data: { organizationId, day: thisMonth, actions: 250 } });
    expect((await getAIBudget(organizationId)).remaining).toBe(0);
    await expect(assertAIWithinBudget(organizationId)).rejects.toThrow(/this month's 250/i);

    await setPlan("flagship");
    // Same usage, bigger plan: an upgrade unlocks immediately.
    expect((await getAIBudget(organizationId)).remaining).toBe(350);
    await testDb.aIUsageDay.create({ data: { organizationId, day: day(now.getUTCFullYear(), now.getUTCMonth(), 2), actions: 350 } });
    await expect(assertAIWithinBudget(organizationId)).rejects.toThrow(/this month's 600/i);
    await testDb.aIUsageDay.deleteMany({ where: { organizationId } });
  });

  it("the free allowance never refills and survives a downgrade: lifetime usage counts", async () => {
    await testDb.aIUsageDay.create({ data: { organizationId, day: lastMonth, actions: 25 } });
    await setPlan("harbor");
    const budget = await getAIBudget(organizationId);
    expect(budget.usedThisMonth).toBe(0);
    expect(budget.usedAllTime).toBe(25);
    expect(budget.remaining).toBe(0);
    await expect(assertAIWithinBudget(organizationId)).rejects.toThrow(/all 25/i);
    await testDb.aIUsageDay.deleteMany({ where: { organizationId } });
    await setPlan("flagship");
  });

  it("is enforced per organization: another tenant's usage never touches this one", async () => {
    const other = await createTestStore("billing-other");
    try {
      await testDb.organization.update({ where: { id: other.organization.id }, data: { plan: "skiff" } });
      await recordAIUsage(other.organization.id, { actions: 100 });
      await expect(assertAIWithinBudget(other.organization.id)).rejects.toThrow(/this month's 100/i);
      await setPlan("skiff");
      const mine = await getAIBudget(organizationId);
      expect(mine.remaining).toBe(100);
      await setPlan("flagship");
    } finally {
      await cleanupTestStore(other.organization.id, other.user.id);
    }
  });
});

describe("spend ceilings and the ledger", () => {
  it("pauses the assistant at the plan's internal spend ceiling even with actions left", async () => {
    await setPlan("skiff");
    await testDb.aIUsageDay.deleteMany({ where: { organizationId } });
    // 10 actions but $10.00 of estimated spend: Skiff's ceiling.
    await recordAIUsage(organizationId, { actions: 10, estimatedCostMicros: 10_000_000 });
    const budget = await getAIBudget(organizationId);
    expect(budget.remaining).toBe(90);
    expect(budget.spendCeilingReached).toBe(true);
    await expect(assertAIWithinBudget(organizationId)).rejects.toThrow(/usage limit/i);
    await expect(assertAIWithinBudget(organizationId)).rejects.not.toThrow(/\$/);
    await testDb.aIUsageDay.deleteMany({ where: { organizationId } });
    await setPlan("flagship");
  });

  it("honours a platform-wide daily brake when one is configured", async () => {
    process.env.AI_PLATFORM_DAILY_SPEND_CEILING_USD = "0.01";
    try {
      await recordAIUsage(organizationId, { actions: 1, estimatedCostMicros: 20_000 });
      const budget = await getAIBudget(organizationId);
      expect(budget.platformPaused).toBe(true);
      await expect(assertAIWithinBudget(organizationId)).rejects.toThrow(/paused/i);
    } finally {
      delete process.env.AI_PLATFORM_DAILY_SPEND_CEILING_USD;
      await testDb.aIUsageDay.deleteMany({ where: { organizationId } });
    }
    expect((await getAIBudget(organizationId)).platformPaused).toBe(false);
  });

  it("records a ledger row with an estimated cost and increments the day in one step", async () => {
    await recordAIRequest(organizationId, {
      storeId: ctx.storeId,
      userId,
      kind: "chat_design",
      tier: "design",
      model: "claude-sonnet-5",
      modelCalls: 4,
      toolCalls: 7,
      usage: { inputTokens: 50, outputTokens: 4000, cacheReadTokens: 80_000, cacheWriteTokens: 9000 },
      status: "ok",
      durationMs: 12_345,
      actions: 1,
    });
    const row = await testDb.aIRequest.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } });
    expect(row?.kind).toBe("chat_design");
    expect(row?.plan).toBe("flagship");
    // 50×2 + 4000×10 + 80000×0.2 + 9000×2.5 = 100 + 40000 + 16000 + 22500 micro-dollars
    expect(row?.estimatedCostMicros).toBe(78_600);
    const today = await testDb.aIUsageDay.findFirst({ where: { organizationId }, orderBy: { day: "desc" } });
    expect(today?.actions).toBe(1);
    expect(today?.estimatedCostMicros).toBe(78_600);
    expect(today?.cacheReadTokens).toBe(80_000);
    await testDb.aIRequest.deleteMany({ where: { organizationId } });
    await testDb.aIUsageDay.deleteMany({ where: { organizationId } });
  });

  it("never throws to its caller, even for an unknown organization", async () => {
    await expect(
      recordAIRequest("org-does-not-exist", {
        kind: "chat", tier: "light", model: "claude-haiku-4-5", modelCalls: 1, toolCalls: 0,
        usage: { inputTokens: 1 }, status: "ok", durationMs: 1, actions: 1,
      }),
    ).resolves.toBeUndefined();
  });
});
