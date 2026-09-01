import "server-only";
import { prisma } from "@/lib/db";
import { getPlan, isPlanId, type Plan } from "@/lib/plans";
import {
  audit, authorize, NotFoundError, ValidationError, type ServiceContext,
} from "@/lib/services/context";
import type { BillingCycle } from "@/generated/prisma/client";

/** Today as a UTC date, matching AIUsageDay.day's DATE column. */
function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function utcMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getOrganizationPlan(organizationId: string): Promise<Plan> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  if (!org) throw new NotFoundError("Organization");
  return getPlan(org.plan);
}

export type AIBudget = {
  plan: Plan;
  usedToday: number;
  usedThisMonth: number;
  /** Remaining actions under whichever meter the plan uses. Null = unmetered. */
  remaining: number | null;
  /** True when the next action would exceed the plan's budget. */
  exhausted: boolean;
};

export async function getAIBudget(organizationId: string): Promise<AIBudget> {
  const plan = await getOrganizationPlan(organizationId);

  const [today, month] = await Promise.all([
    prisma.aIUsageDay.findUnique({
      where: { organizationId_day: { organizationId, day: utcToday() } },
      select: { actions: true },
    }),
    prisma.aIUsageDay.aggregate({
      where: { organizationId, day: { gte: utcMonthStart() } },
      _sum: { actions: true },
    }),
  ]);

  const usedToday = today?.actions ?? 0;
  const usedThisMonth = month._sum.actions ?? 0;

  let remaining: number | null = null;
  if (plan.limits.aiActionsPerDay !== null) {
    remaining = Math.max(0, plan.limits.aiActionsPerDay - usedToday);
  } else if (plan.limits.aiActionsPerMonth !== null) {
    remaining = Math.max(0, plan.limits.aiActionsPerMonth - usedThisMonth);
  }

  return { plan, usedToday, usedThisMonth, remaining, exhausted: remaining === 0 };
}

/**
 * Called before the assistant does any work. The message names the meter that
 * ran out so the operator knows whether waiting or upgrading fixes it.
 */
export async function assertAIWithinBudget(organizationId: string): Promise<AIBudget> {
  const budget = await getAIBudget(organizationId);
  if (!budget.exhausted) return budget;

  if (budget.plan.limits.aiActionsPerDay !== null) {
    throw new ValidationError(
      `You've used today's ${budget.plan.limits.aiActionsPerDay} free AI actions. They reset at midnight UTC — or upgrade for a monthly allowance.`,
    );
  }
  throw new ValidationError(
    `You've used this month's ${budget.plan.limits.aiActionsPerMonth} AI actions on the ${budget.plan.name} plan. Upgrade to keep going, or they reset next month.`,
  );
}

export type AIUsageDelta = {
  actions?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

/**
 * Records usage against today's row. Metering must never break the assistant,
 * so callers are expected to .catch(() => {}) — losing one usage row is better
 * than failing a conversation that already cost tokens.
 */
export async function recordAIUsage(organizationId: string, delta: AIUsageDelta) {
  const day = utcToday();
  const increments = {
    actions: delta.actions ?? 0,
    inputTokens: delta.inputTokens ?? 0,
    outputTokens: delta.outputTokens ?? 0,
    cacheReadTokens: delta.cacheReadTokens ?? 0,
    cacheWriteTokens: delta.cacheWriteTokens ?? 0,
  };
  await prisma.aIUsageDay.upsert({
    where: { organizationId_day: { organizationId, day } },
    create: { organizationId, day, ...increments },
    update: {
      actions: { increment: increments.actions },
      inputTokens: { increment: increments.inputTokens },
      outputTokens: { increment: increments.outputTokens },
      cacheReadTokens: { increment: increments.cacheReadTokens },
      cacheWriteTokens: { increment: increments.cacheWriteTokens },
    },
  });
}

// -- plan limit checks used by the write services ---------------------------

async function planAndOrg(ctx: ServiceContext) {
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
  if (!org) throw new NotFoundError("Organization");
  return { org, plan: getPlan(org.plan) };
}

export async function assertCanAddProduct(ctx: ServiceContext) {
  const { plan } = await planAndOrg(ctx);
  if (plan.limits.products === null) return;
  const count = await prisma.product.count({ where: { storeId: ctx.storeId } });
  if (count >= plan.limits.products) {
    throw new ValidationError(
      `The ${plan.name} plan includes ${plan.limits.products} products. Upgrade for unlimited products.`,
    );
  }
}

export async function assertCanAddTeamMember(ctx: ServiceContext) {
  const { plan } = await planAndOrg(ctx);
  if (plan.limits.teamMembers === null) return;
  const count = await prisma.membership.count({ where: { organizationId: ctx.organizationId } });
  if (count >= plan.limits.teamMembers) {
    throw new ValidationError(
      `The ${plan.name} plan includes ${plan.limits.teamMembers} team member${plan.limits.teamMembers === 1 ? "" : "s"}. Upgrade to add more.`,
    );
  }
}

export async function assertCanStartExperiment(ctx: ServiceContext) {
  const { plan } = await planAndOrg(ctx);
  if (plan.limits.runningExperiments === null) return;
  const running = await prisma.experiment.count({
    where: { storeId: ctx.storeId, status: "RUNNING" },
  });
  if (running >= plan.limits.runningExperiments) {
    throw new ValidationError(
      `The ${plan.name} plan runs ${plan.limits.runningExperiments} A/B test${plan.limits.runningExperiments === 1 ? "" : "s"} at a time. Pause one, or upgrade for unlimited tests.`,
    );
  }
}

export async function assertCanSendCampaigns(ctx: ServiceContext) {
  const { plan } = await planAndOrg(ctx);
  if (!plan.limits.emailCampaigns) {
    throw new ValidationError(
      `Email campaigns are included from the Clipper plan up. You can draft on ${plan.name}; sending needs an upgrade.`,
    );
  }
}

// -- plan changes -----------------------------------------------------------

export type BillingView = {
  plan: Plan;
  planStatus: string;
  billingCycle: BillingCycle;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  billingConnected: boolean;
  usage: {
    aiToday: number;
    aiThisMonth: number;
    aiRemaining: number | null;
    teamMembers: number;
    products: number;
    runningExperiments: number;
  };
};

export async function getBillingView(ctx: ServiceContext): Promise<BillingView> {
  authorize(ctx, "settings:read");
  const { org, plan } = await planAndOrg(ctx);
  const [budget, teamMembers, products, runningExperiments] = await Promise.all([
    getAIBudget(ctx.organizationId),
    prisma.membership.count({ where: { organizationId: ctx.organizationId } }),
    prisma.product.count({ where: { storeId: ctx.storeId } }),
    prisma.experiment.count({ where: { storeId: ctx.storeId, status: "RUNNING" } }),
  ]);

  return {
    plan,
    planStatus: org.planStatus,
    billingCycle: org.billingCycle,
    currentPeriodEnd: org.currentPeriodEnd,
    cancelAtPeriodEnd: org.cancelAtPeriodEnd,
    billingConnected: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    usage: {
      aiToday: budget.usedToday,
      aiThisMonth: budget.usedThisMonth,
      aiRemaining: budget.remaining,
      teamMembers,
      products,
      runningExperiments,
    },
  };
}

/**
 * Changes the organization's plan locally.
 *
 * Until Stripe Billing is connected this is the entire flow — no card, no
 * charge, and the UI says so. Once Stripe is configured, checkout happens
 * through Stripe and this function is only reached by the webhook handler or
 * for free-plan moves.
 *
 * Downgrades are refused while current usage exceeds the target's limits, so
 * an organization can never end up silently over its own plan.
 */
export async function changePlan(
  ctx: ServiceContext,
  targetId: string,
  cycle: BillingCycle = "MONTHLY",
) {
  authorize(ctx, "billing:manage");
  if (!isPlanId(targetId)) throw new ValidationError("That plan does not exist.");

  const { org, plan: current } = await planAndOrg(ctx);
  const target = getPlan(targetId);
  if (current.id === target.id && org.billingCycle === cycle) return org;

  const blockers: string[] = [];
  if (target.limits.teamMembers !== null) {
    const members = await prisma.membership.count({ where: { organizationId: ctx.organizationId } });
    if (members > target.limits.teamMembers) {
      blockers.push(`remove ${members - target.limits.teamMembers} team member${members - target.limits.teamMembers === 1 ? "" : "s"} (${target.name} includes ${target.limits.teamMembers})`);
    }
  }
  if (target.limits.stores !== null) {
    const stores = await prisma.store.count({ where: { organizationId: ctx.organizationId } });
    if (stores > target.limits.stores) {
      blockers.push(`archive ${stores - target.limits.stores} store${stores - target.limits.stores === 1 ? "" : "s"} (${target.name} includes ${target.limits.stores})`);
    }
  }
  if (target.limits.products !== null) {
    const products = await prisma.product.count({ where: { storeId: ctx.storeId } });
    if (products > target.limits.products) {
      blockers.push(`reduce the catalog to ${target.limits.products} products`);
    }
  }
  if (blockers.length) {
    throw new ValidationError(`Before moving to ${target.name}: ${blockers.join("; ")}.`);
  }

  const updated = await prisma.organization.update({
    where: { id: ctx.organizationId },
    data: { plan: target.id, billingCycle: cycle, planStatus: "ACTIVE" },
  });
  await audit(ctx, "billing.plan_change", { type: "Organization", id: ctx.organizationId }, {
    from: current.id,
    to: target.id,
    cycle,
  });
  return updated;
}
