/**
 * The four Halyard plans.
 *
 * Prices here are the source of truth for the marketing page, the billing
 * screen, and (when Stripe Billing is connected) the price-creation script.
 * Limits are enforced server-side in the services via `src/lib/services/billing.ts`
 * — the UI reads them for display but never decides.
 *
 * "AI actions" is the customer-facing unit: one assistant task. Internally it
 * is metered per request in AIUsageDay, alongside exact token counts so the
 * real cost of every organization is always knowable.
 */
export type PlanId = "harbor" | "skiff" | "clipper" | "flagship";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** USD per month, billed monthly. Harbor is 0. */
  monthly: number;
  /** USD per month when billed annually. */
  annualMonthly: number;
  /** First-month promotional price on paid plans (USD). Null = none. */
  introFirstMonth: number | null;
  features: string[];
  limits: {
    stores: number;
    products: number | null;
    teamMembers: number | null;
    runningExperiments: number | null;
    /** Null on Harbor — free AI is metered per day instead. */
    aiActionsPerMonth: number | null;
    aiActionsPerDay: number | null;
    emailCampaigns: boolean;
    liveCheckout: boolean;
    analyticsHistoryDays: number | null;
    analyticsExport: boolean;
  };
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "harbor",
    name: "Harbor",
    tagline: "The whole platform, in the harbor. Build the store, try the AI.",
    monthly: 0,
    annualMonthly: 0,
    introFirstMonth: null,
    features: [
      "Full admin and storefront",
      "AI assistant — 10 actions a day",
      "Up to 25 products",
      "1 A/B test running",
      "Checkout in test mode",
    ],
    limits: {
      stores: 1,
      products: 25,
      teamMembers: 1,
      runningExperiments: 1,
      aiActionsPerMonth: null,
      aiActionsPerDay: 10,
      emailCampaigns: false,
      liveCheckout: false,
      analyticsHistoryDays: 30,
      analyticsExport: false,
    },
  },
  {
    id: "skiff",
    name: "Skiff",
    tagline: "One store, one operator, open for business.",
    monthly: 19,
    annualMonthly: 15,
    introFirstMonth: 1,
    features: [
      "Live checkout, 0% platform fees",
      "Unlimited products",
      "300 AI actions a month",
      "2 A/B tests running",
      "2 team members",
      "Full analytics history",
    ],
    limits: {
      stores: 1,
      products: null,
      teamMembers: 2,
      runningExperiments: 2,
      aiActionsPerMonth: 300,
      aiActionsPerDay: null,
      emailCampaigns: false,
      liveCheckout: true,
      analyticsHistoryDays: null,
      analyticsExport: false,
    },
  },
  {
    id: "clipper",
    name: "Clipper",
    tagline: "The AI runs experiments, the team runs the brand.",
    monthly: 49,
    annualMonthly: 39,
    introFirstMonth: 1,
    features: [
      "Everything in Skiff",
      "1,500 AI actions a month",
      "Unlimited A/B tests",
      "Email campaigns and subscribers",
      "5 team members",
    ],
    limits: {
      stores: 1,
      products: null,
      teamMembers: 5,
      runningExperiments: null,
      aiActionsPerMonth: 1500,
      aiActionsPerDay: null,
      emailCampaigns: true,
      liveCheckout: true,
      analyticsHistoryDays: null,
      analyticsExport: false,
    },
    highlight: true,
  },
  {
    id: "flagship",
    name: "Flagship",
    tagline: "Several stores, a full crew, and room to run.",
    monthly: 129,
    annualMonthly: 99,
    introFirstMonth: 1,
    features: [
      "Everything in Clipper",
      "6,000 AI actions a month",
      "Up to 3 stores",
      "Unlimited team members",
      "Analytics export",
    ],
    limits: {
      stores: 3,
      products: null,
      teamMembers: null,
      runningExperiments: null,
      aiActionsPerMonth: 6000,
      aiActionsPerDay: null,
      emailCampaigns: true,
      liveCheckout: true,
      analyticsHistoryDays: null,
      analyticsExport: true,
    },
  },
];

const byId = new Map(PLANS.map((plan) => [plan.id, plan]));

/** Unknown or legacy plan strings resolve to Harbor — the safe floor. */
export function getPlan(id: string): Plan {
  return byId.get(id as PlanId) ?? PLANS[0];
}

export function isPlanId(id: string): id is PlanId {
  return byId.has(id as PlanId);
}

/** Annual billing saves this much vs. twelve monthly payments. */
export function annualSavings(plan: Plan): number {
  return (plan.monthly - plan.annualMonthly) * 12;
}
