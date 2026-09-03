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
    /** Monthly allowance on paid plans; null on Harbor. */
    aiActionsPerMonth: number | null;
    /**
     * One-time allowance for the free plan — spent once, never refilled. Free
     * exists to build and explore, not to run a business on a drip of free
     * API cost; the allowance ending is the natural "make it real" moment.
     */
    aiStarterActions: number | null;
    /**
     * Internal hard safety ceiling on estimated Anthropic spend, in US cents —
     * per calendar month on paid plans, over the account's life on Harbor.
     * It sits well above what the action allowance normally costs, so a
     * customer only meets it when actions are running abnormally expensive.
     * Never shown to customers; the limit they see is the action count.
     */
    aiSpendCeilingCents: number;
    emailCampaigns: boolean;
    liveCheckout: boolean;
    /** Connecting a custom domain — an operating concern, so paid. */
    customDomain: boolean;
    /** Free storefronts carry a small "Built on Halyard" credit. */
    halyardBranding: boolean;
    /** Rolling count of design snapshots kept per store (oldest eligible pruned). */
    designSnapshots: number;
    analyticsHistoryDays: number | null;
    analyticsExport: boolean;
  };
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "harbor",
    name: "Harbor",
    tagline: "Build the whole store, free. Launch it when you're ready.",
    monthly: 0,
    annualMonthly: 0,
    introFirstMonth: null,
    features: [
      "Full admin, storefront and page editor",
      "Up to 50 products",
      "25 AI actions to build with",
      "1 A/B test running",
      "Checkout in test mode",
      "Built on Halyard storefront credit",
    ],
    limits: {
      stores: 1,
      products: 50,
      teamMembers: 1,
      runningExperiments: 1,
      aiActionsPerMonth: null,
      aiStarterActions: 25,
      aiSpendCeilingCents: 250,
      emailCampaigns: false,
      liveCheckout: false,
      customDomain: false,
      halyardBranding: true,
      designSnapshots: 5,
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
      "Custom domain, no Halyard branding",
      "Unlimited products",
      "100 AI actions a month",
      "2 A/B tests running",
      "2 team members",
    ],
    limits: {
      stores: 1,
      products: null,
      teamMembers: 2,
      runningExperiments: 2,
      aiActionsPerMonth: 100,
      aiStarterActions: null,
      aiSpendCeilingCents: 1000,
      emailCampaigns: false,
      liveCheckout: true,
      customDomain: true,
      halyardBranding: false,
      designSnapshots: 20,
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
      "250 AI actions a month",
      "Unlimited A/B tests",
      "Email campaigns and subscribers",
      "5 team members",
    ],
    limits: {
      stores: 1,
      products: null,
      teamMembers: 5,
      runningExperiments: null,
      aiActionsPerMonth: 250,
      aiStarterActions: null,
      aiSpendCeilingCents: 2500,
      emailCampaigns: true,
      liveCheckout: true,
      customDomain: true,
      halyardBranding: false,
      designSnapshots: 50,
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
      "600 AI actions a month",
      "Up to 3 stores",
      "Unlimited team members",
      "Analytics export",
    ],
    limits: {
      stores: 3,
      products: null,
      teamMembers: null,
      runningExperiments: null,
      aiActionsPerMonth: 600,
      aiStarterActions: null,
      aiSpendCeilingCents: 6000,
      emailCampaigns: true,
      liveCheckout: true,
      customDomain: true,
      halyardBranding: false,
      designSnapshots: 100,
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
