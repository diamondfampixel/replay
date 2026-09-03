import "server-only";
import { prisma } from "@/lib/db";
import { PLANS, type Plan, type PlanId } from "@/lib/plans";
import { microsToUsd } from "@/lib/ai/pricing";

/**
 * Platform economics: what each plan brings in against what its AI usage
 * costs, from the AIRequest ledger. Aggregates only — no organization's
 * private content is read, and demo/test organizations are separated so the
 * real figures are never diluted by fixtures.
 *
 * "Revenue" here is nominal (plan price × organizations on it). Until Stripe
 * is live and the webhook writes plan state, no money has actually been
 * collected, and the report says so.
 */
export type EconomicsClass = "HEALTHY AI ECONOMICS" | "AT-RISK AI ECONOMICS" | "UNPROFITABLE AT FULL USAGE" | "NO DATA";

export type PlanEconomics = {
  plan: Plan;
  organizations: number;
  demoOrganizations: number;
  /** Nominal monthly subscription revenue across real organizations (USD). */
  revenueMonthly: number;
  /** Included allowance: lifetime on Harbor, per month elsewhere. */
  allowance: number;
  /** This month, real organizations only. */
  actionsTotal: number;
  actionsPerOrg: number;
  costPerOrg: number;
  costPerOrgMax: number;
  costPerAction: number | null;
  /** Price minus average AI cost per organization (USD/month), before every other cost. */
  grossAfterAI: number;
  /** Allowance × the observed (or assumed) cost of the most expensive action kind. */
  worstCaseAI: number;
  /** Allowance × 30% × the observed (or assumed) average action cost. */
  typicalAI: number;
  spendCeiling: number;
  classification: EconomicsClass;
};

export type KindEconomics = {
  kind: string;
  requests: number;
  avgCost: number;
  maxCost: number;
  avgOutputTokens: number;
  avgContextTokens: number;
  guardStops: number;
  errors: number;
};

export type PlatformEconomics = {
  generatedAt: Date;
  monthStart: Date;
  /** development = no Stripe, NODE_ENV≠production, or only demo/test orgs. */
  dataMode: "development" | "production";
  dataModeReason: string;
  assumptions: { avgActionUsd: number; designActionUsd: number; source: "observed" | "assumed" };
  plans: PlanEconomics[];
  kinds: KindEconomics[];
  totals: { requests: number; actions: number; costUsd: number; guardStops: number; realOrganizations: number; demoOrganizations: number };
  ceilingEvents: number;
};

/** Fallbacks used until the ledger holds enough real requests to speak for itself. */
export const ASSUMED_AVG_ACTION_USD = 0.045;
export const ASSUMED_DESIGN_ACTION_USD = 0.1;

function utcMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function isDemoLike(org: { isDemo: boolean; memberships: Array<{ user: { email: string } }> }): boolean {
  if (org.isDemo) return true;
  return org.memberships.some(({ user }) => /@(example\.test|halyard-demo\.dev)$|^demo@halyard\.app$/i.test(user.email));
}

export function classify(plan: Plan, worstCaseAI: number): EconomicsClass {
  if (plan.monthly === 0) {
    // Free has no revenue; a bounded lifetime allowance is healthy by design.
    return worstCaseAI <= plan.limits.aiSpendCeilingCents / 100 ? "HEALTHY AI ECONOMICS" : "AT-RISK AI ECONOMICS";
  }
  const share = worstCaseAI / plan.monthly;
  if (share < 0.4) return "HEALTHY AI ECONOMICS";
  if (share < 0.7) return "AT-RISK AI ECONOMICS";
  return "UNPROFITABLE AT FULL USAGE";
}

export async function getPlatformEconomics(now = new Date()): Promise<PlatformEconomics> {
  const monthStart = utcMonthStart(now);

  const [organizations, requests] = await Promise.all([
    prisma.organization.findMany({
      select: {
        id: true, plan: true, billingCycle: true, isDemo: true,
        memberships: { select: { user: { select: { email: true } } } },
      },
    }),
    prisma.aIRequest.findMany({
      where: { createdAt: { gte: monthStart } },
      select: {
        organizationId: true, plan: true, kind: true, estimatedCostMicros: true,
        outputTokens: true, inputTokens: true, cacheReadTokens: true, cacheWriteTokens: true,
        status: true, guard: true,
      },
    }),
  ]);

  const demoIds = new Set(organizations.filter(isDemoLike).map((org) => org.id));
  const realRequests = requests.filter((request) => !demoIds.has(request.organizationId));

  // Observed per-action costs, real organizations first, demo as a fallback so
  // a development database still shows the shape of the economics.
  const sample = realRequests.length >= 20 ? realRequests : requests;
  const avg = (rows: typeof requests) => (rows.length ? rows.reduce((sum, row) => sum + row.estimatedCostMicros, 0) / rows.length : 0);
  const observedAvg = microsToUsd(avg(sample));
  const designRows = sample.filter((row) => row.kind === "chat_design");
  const observedDesign = designRows.length ? microsToUsd(avg(designRows)) : null;
  const assumptions: PlatformEconomics["assumptions"] = sample.length >= 10
    ? { avgActionUsd: observedAvg, designActionUsd: Math.max(observedDesign ?? observedAvg, observedAvg), source: "observed" }
    : { avgActionUsd: ASSUMED_AVG_ACTION_USD, designActionUsd: ASSUMED_DESIGN_ACTION_USD, source: "assumed" };

  const plans: PlanEconomics[] = PLANS.map((plan) => {
    const onPlan = organizations.filter((org) => org.plan === plan.id);
    const real = onPlan.filter((org) => !demoIds.has(org.id));
    const revenueMonthly = real.reduce(
      (sum, org) => sum + (org.billingCycle === "ANNUAL" ? plan.annualMonthly : plan.monthly),
      0,
    );
    const byOrg = new Map<string, { actions: number; cost: number }>();
    for (const request of realRequests) {
      if (request.plan !== plan.id) continue;
      const row = byOrg.get(request.organizationId) ?? { actions: 0, cost: 0 };
      row.actions += 1;
      row.cost += request.estimatedCostMicros;
      byOrg.set(request.organizationId, row);
    }
    const rows = [...byOrg.values()];
    const actionsTotal = rows.reduce((sum, row) => sum + row.actions, 0);
    const costTotal = rows.reduce((sum, row) => sum + row.cost, 0);
    const orgCount = real.length || 0;
    const allowance = plan.limits.aiStarterActions ?? plan.limits.aiActionsPerMonth ?? 0;
    const costPerOrg = orgCount ? microsToUsd(costTotal / orgCount) : 0;
    const worstCaseAI = allowance * assumptions.designActionUsd;
    const typicalAI = allowance * 0.3 * assumptions.avgActionUsd;
    return {
      plan,
      organizations: onPlan.length,
      demoOrganizations: onPlan.length - real.length,
      revenueMonthly,
      allowance,
      actionsTotal,
      actionsPerOrg: orgCount ? actionsTotal / orgCount : 0,
      costPerOrg,
      costPerOrgMax: rows.length ? microsToUsd(Math.max(...rows.map((row) => row.cost))) : 0,
      costPerAction: actionsTotal ? microsToUsd(costTotal / actionsTotal) : null,
      grossAfterAI: (plan.monthly === 0 ? 0 : plan.monthly) - costPerOrg,
      worstCaseAI,
      typicalAI,
      spendCeiling: plan.limits.aiSpendCeilingCents / 100,
      classification: classify(plan, worstCaseAI),
    };
  });

  const kindMap = new Map<string, KindEconomics & { costSum: number; outSum: number; ctxSum: number }>();
  for (const request of sample) {
    const row = kindMap.get(request.kind) ?? {
      kind: request.kind, requests: 0, avgCost: 0, maxCost: 0, avgOutputTokens: 0, avgContextTokens: 0, guardStops: 0, errors: 0,
      costSum: 0, outSum: 0, ctxSum: 0,
    };
    row.requests += 1;
    row.costSum += request.estimatedCostMicros;
    row.maxCost = Math.max(row.maxCost, microsToUsd(request.estimatedCostMicros));
    row.outSum += request.outputTokens;
    row.ctxSum += request.inputTokens + request.cacheReadTokens + request.cacheWriteTokens;
    if (request.status === "guard") row.guardStops += 1;
    if (request.status === "error") row.errors += 1;
    kindMap.set(request.kind, row);
  }
  const kinds: KindEconomics[] = [...kindMap.values()]
    .map((row) => ({
      kind: row.kind,
      requests: row.requests,
      avgCost: microsToUsd(row.costSum / row.requests),
      maxCost: row.maxCost,
      avgOutputTokens: Math.round(row.outSum / row.requests),
      avgContextTokens: Math.round(row.ctxSum / row.requests),
      guardStops: row.guardStops,
      errors: row.errors,
    }))
    .sort((a, b) => b.avgCost - a.avgCost);

  const realOrganizations = organizations.length - demoIds.size;
  const stripeLive = Boolean(process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_"));
  const production = process.env.NODE_ENV === "production" && stripeLive && realOrganizations > 0;
  const dataModeReason = production
    ? "Stripe live keys are configured and real organizations exist."
    : !stripeLive
      ? "Stripe is not in live mode, so no subscription revenue has been collected; plan prices are nominal."
      : realOrganizations === 0
        ? "Only demo and test organizations exist."
        : "Not a production build.";

  return {
    generatedAt: now,
    monthStart,
    dataMode: production ? "production" : "development",
    dataModeReason,
    assumptions,
    plans,
    kinds,
    totals: {
      requests: realRequests.length,
      actions: realRequests.length,
      costUsd: microsToUsd(realRequests.reduce((sum, row) => sum + row.estimatedCostMicros, 0)),
      guardStops: realRequests.filter((row) => row.status === "guard").length,
      realOrganizations,
      demoOrganizations: demoIds.size,
    },
    ceilingEvents: requests.filter((row) => row.status === "budget").length,
  };
}

export function planById(id: PlanId): Plan {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0];
}
