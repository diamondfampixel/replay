import "server-only";
import { prisma } from "@/lib/db";
import { getPlan, isPlanId, PLANS, type Plan } from "@/lib/plans";
import { estimateCostMicros, type TokenUsage } from "@/lib/ai/pricing";
import { reportAlert, reportError } from "@/lib/monitoring";
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
  usedThisMonth: number;
  /** Lifetime actions — what the free starter allowance is measured against. */
  usedAllTime: number;
  /** Remaining actions under whichever meter the plan uses. Null = unmetered. */
  remaining: number | null;
  /** True when the next action would exceed the plan's budget. */
  exhausted: boolean;
  /**
   * Estimated Anthropic spend (micro-dollars) inside the plan's meter window —
   * this month on paid plans, all-time on Harbor. Internal; never shown.
   */
  spendMicros: number;
  /** The internal safety ceiling was reached: the assistant pauses even with actions left. */
  spendCeilingReached: boolean;
  /** Halyard-wide daily ceiling (AI_PLATFORM_DAILY_SPEND_CEILING_USD) was reached. */
  platformPaused: boolean;
};

const MICROS_PER_CENT = 10_000;

/** Today's estimated spend across every organization, in micro-dollars. */
export async function getPlatformSpendToday(): Promise<number> {
  const today = await prisma.aIUsageDay.aggregate({
    where: { day: utcToday() },
    _sum: { estimatedCostMicros: true },
  });
  return today._sum.estimatedCostMicros ?? 0;
}

/** Optional platform-wide daily brake, in USD. Unset = no platform ceiling. */
export function platformDailyCeilingMicros(): number | null {
  const raw = Number(process.env.AI_PLATFORM_DAILY_SPEND_CEILING_USD ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw * 1_000_000) : null;
}

export async function getAIBudget(organizationId: string): Promise<AIBudget> {
  const plan = await getOrganizationPlan(organizationId);

  const [month, allTime, platformToday] = await Promise.all([
    prisma.aIUsageDay.aggregate({
      where: { organizationId, day: { gte: utcMonthStart() } },
      _sum: { actions: true, estimatedCostMicros: true },
    }),
    prisma.aIUsageDay.aggregate({
      where: { organizationId },
      _sum: { actions: true, estimatedCostMicros: true },
    }),
    platformDailyCeilingMicros() !== null ? getPlatformSpendToday() : Promise.resolve(0),
  ]);

  const usedThisMonth = month._sum.actions ?? 0;
  const usedAllTime = allTime._sum.actions ?? 0;
  const lifetimeMeter = plan.limits.aiStarterActions !== null;

  let remaining: number | null = null;
  if (lifetimeMeter) {
    // The free allowance is one-time: spent across the account's whole life,
    // never refilled. Free is for building; a refilling drip would let a live
    // business run on our API bill indefinitely.
    remaining = Math.max(0, plan.limits.aiStarterActions! - usedAllTime);
  } else if (plan.limits.aiActionsPerMonth !== null) {
    remaining = Math.max(0, plan.limits.aiActionsPerMonth - usedThisMonth);
  }

  // Second, invisible meter: estimated dollars. The action allowance is what
  // customers see; this one exists so an abnormal run of very expensive
  // actions (or a bug) cannot outspend the subscription.
  const spendMicros = lifetimeMeter
    ? (allTime._sum.estimatedCostMicros ?? 0)
    : (month._sum.estimatedCostMicros ?? 0);
  const spendCeilingReached = spendMicros >= plan.limits.aiSpendCeilingCents * MICROS_PER_CENT;

  const platformCeiling = platformDailyCeilingMicros();
  const platformPaused = platformCeiling !== null && platformToday >= platformCeiling;

  return {
    plan,
    usedThisMonth,
    usedAllTime,
    remaining,
    exhausted: remaining === 0,
    spendMicros,
    spendCeilingReached,
    platformPaused,
  };
}

const FIRST_PAID_PLAN = PLANS.find((plan) => plan.limits.aiActionsPerMonth !== null)!;

/**
 * Called before the assistant does any work. The message names the meter that
 * ran out so the operator knows whether waiting or upgrading fixes it. The
 * dollar ceilings deliberately read as a usage limit, not a price.
 */
export async function assertAIWithinBudget(organizationId: string): Promise<AIBudget> {
  const budget = await getAIBudget(organizationId);
  const { plan } = budget;
  const lifetimeMeter = plan.limits.aiStarterActions !== null;

  if (budget.platformPaused) {
    throw new ValidationError(
      "The assistant is paused for a short while across Halyard. Nothing else is affected — please try again later.",
    );
  }

  if (budget.exhausted) {
    if (lifetimeMeter) {
      throw new ValidationError(
        `You've used all ${plan.limits.aiStarterActions} of ${plan.name}'s starter AI actions. Paid plans include a monthly allowance — from ${FIRST_PAID_PLAN.limits.aiActionsPerMonth} actions on ${FIRST_PAID_PLAN.name}.`,
      );
    }
    throw new ValidationError(
      `You've used this month's ${plan.limits.aiActionsPerMonth} AI actions on the ${plan.name} plan. Upgrade to keep going, or they reset next month.`,
    );
  }

  if (budget.spendCeilingReached) {
    throw new ValidationError(
      lifetimeMeter
        ? `The assistant has reached ${plan.name}'s usage limit. Upgrade to a paid plan to keep going.`
        : `The assistant has reached this month's usage limit on the ${plan.name} plan. It resets next month; upgrading raises it.`,
    );
  }

  return budget;
}

export type AIUsageDelta = {
  actions?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  estimatedCostMicros?: number;
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
    estimatedCostMicros: delta.estimatedCostMicros ?? 0,
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
      estimatedCostMicros: { increment: increments.estimatedCostMicros },
    },
  });
}

export type AIRequestKind = "chat" | "chat_read" | "chat_write" | "chat_design" | "variants" | "onboarding";
export type AIRequestTier = "light" | "standard" | "design";
export type AIRequestStatus = "ok" | "error" | "guard" | "budget";

export type AIRequestEntry = {
  storeId?: string | null;
  userId?: string | null;
  kind: AIRequestKind;
  tier: AIRequestTier;
  model: string;
  modelCalls: number;
  toolCalls: number;
  usage: Partial<TokenUsage>;
  status: AIRequestStatus;
  guard?: string | null;
  durationMs: number;
  /** Customer-visible actions to charge (normally 1; 0 when nothing was served). */
  actions: number;
};

/** A single request costing more than this is reported as abnormal. */
export const ABNORMAL_REQUEST_MICROS = 500_000; // $0.50

/**
 * The economics ledger: one row per real AI request plus the day-level
 * increment the budgets read. Also the place abnormal use is noticed — a
 * request far above the norm, or an organization crossing its ceiling — and
 * reported to the monitoring webhook. Never throws to its caller.
 */
export async function recordAIRequest(organizationId: string, entry: AIRequestEntry) {
  try {
    const plan = await getOrganizationPlan(organizationId);
    const usage = {
      inputTokens: entry.usage.inputTokens ?? 0,
      outputTokens: entry.usage.outputTokens ?? 0,
      cacheReadTokens: entry.usage.cacheReadTokens ?? 0,
      cacheWriteTokens: entry.usage.cacheWriteTokens ?? 0,
    };
    const estimatedCostMicros = estimateCostMicros(entry.model, usage);

    await prisma.aIRequest.create({
      data: {
        organizationId,
        storeId: entry.storeId ?? null,
        userId: entry.userId ?? null,
        plan: plan.id,
        kind: entry.kind,
        tier: entry.tier,
        model: entry.model,
        modelCalls: entry.modelCalls,
        toolCalls: entry.toolCalls,
        ...usage,
        estimatedCostMicros,
        status: entry.status,
        guard: entry.guard ?? null,
        durationMs: entry.durationMs,
      },
    });
    await recordAIUsage(organizationId, { actions: entry.actions, ...usage, estimatedCostMicros });

    if (estimatedCostMicros >= ABNORMAL_REQUEST_MICROS) {
      reportAlert("ai/abnormal-request", `AI request cost ≈ $${(estimatedCostMicros / 1e6).toFixed(2)} (${entry.kind}, ${entry.model})`, {
        organizationId, plan: plan.id, kind: entry.kind, modelCalls: entry.modelCalls, toolCalls: entry.toolCalls, status: entry.status,
      });
    }
    if (entry.status === "guard") {
      reportAlert("ai/guard", `AI safeguard stopped a request: ${entry.guard}`, { organizationId, plan: plan.id, kind: entry.kind });
    }

    const budget = await getAIBudget(organizationId);
    const ceilingMicros = plan.limits.aiSpendCeilingCents * MICROS_PER_CENT;
    const before = budget.spendMicros - estimatedCostMicros;
    for (const fraction of [0.8, 1]) {
      const line = ceilingMicros * fraction;
      if (before < line && budget.spendMicros >= line) {
        reportAlert(
          "ai/spend-ceiling",
          `Organization reached ${Math.round(fraction * 100)}% of its ${plan.name} AI spend ceiling`,
          { organizationId, plan: plan.id, spendUsd: Number((budget.spendMicros / 1e6).toFixed(2)), actions: budget.usedThisMonth },
        );
      }
    }
  } catch (error) {
    reportError("billing/recordAIRequest", error, { organizationId });
  }
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
    aiThisMonth: number;
    aiAllTime: number;
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
      aiThisMonth: budget.usedThisMonth,
      aiAllTime: budget.usedAllTime,
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

  // With a live Stripe subscription, the subscription is the source of truth:
  // moving off a paid plan goes through Stripe's portal so the charge actually
  // stops, rather than a local write that leaves them paying.
  if (org.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY?.trim()) {
    throw new ValidationError(
      "This organization has an active paid subscription. Change or cancel it from Manage billing so the charge follows the plan.",
    );
  }

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
