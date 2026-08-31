/**
 * Placeholder pricing. Billing is NOT implemented — no Stripe subscription,
 * no charge is ever made. Plans exist so feature gating has something real to
 * read, and every plan currently resolves to the same unlocked feature set in
 * development.
 */
export type PlanId = "demo" | "starter" | "growth" | "pro";

export type Plan = {
  id: PlanId;
  name: string;
  price: number | null;
  cadence: string;
  tagline: string;
  features: string[];
  limits: { products: number | null; experiments: number | null; teamMembers: number | null; aiActionsPerMonth: number | null };
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "demo",
    name: "Demo",
    price: 0,
    cadence: "forever",
    tagline: "A fully seeded business to click through.",
    features: [
      "Seeded demo store with 180 days of history",
      "Every admin surface unlocked",
      "AI assistant when you supply an API key",
      "Data is flagged as demo throughout",
    ],
    limits: { products: null, experiments: null, teamMembers: 2, aiActionsPerMonth: null },
  },
  {
    id: "starter",
    name: "Starter",
    price: 29,
    cadence: "per month",
    tagline: "One store, one operator.",
    features: [
      "Unlimited products and collections",
      "Storefront, cart and checkout",
      "Analytics and conversion funnel",
      "2 concurrent experiments",
      "1 team member",
    ],
    limits: { products: null, experiments: 2, teamMembers: 1, aiActionsPerMonth: 200 },
  },
  {
    id: "growth",
    name: "Growth",
    price: 79,
    cadence: "per month",
    tagline: "For a store with a team behind it.",
    features: [
      "Everything in Starter",
      "Unlimited experiments",
      "Email campaigns and subscriber lists",
      "Roles and permissions",
      "5 team members",
    ],
    limits: { products: null, experiments: null, teamMembers: 5, aiActionsPerMonth: 2000 },
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 199,
    cadence: "per month",
    tagline: "Multiple stores and heavier automation.",
    features: [
      "Everything in Growth",
      "Multiple stores per organization",
      "Priority AI throughput",
      "Audit log export",
      "Unlimited team members",
    ],
    limits: { products: null, experiments: null, teamMembers: null, aiActionsPerMonth: null },
  },
];

export function getPlan(id: string): Plan {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0];
}
