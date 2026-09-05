import "server-only";
import Stripe from "stripe";
import type { BillingCycle } from "@/generated/prisma/client";
import { PLANS, type PlanId } from "@/lib/plans";

/**
 * Stripe Billing, entirely behind STRIPE_SECRET_KEY. Until the key exists,
 * every caller sees "not configured" and plan changes stay local and free —
 * the UI says so. Nothing here fakes a charge or a connection.
 */
export function isStripeBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  if (!client) client = new Stripe(key);
  return client;
}

/**
 * Prices are looked up by key, never by hardcoded id, so the same code works
 * against test and live mode. `scripts/stripe-setup.ts` creates them.
 */
export function priceLookupKey(planId: PlanId, cycle: BillingCycle): string {
  return `halyard_${planId}_${cycle.toLowerCase()}`;
}

export function planFromLookupKey(
  key: string | null | undefined,
): { planId: PlanId; cycle: BillingCycle } | null {
  if (!key) return null;
  const match = /^halyard_([a-z]+)_(monthly|annual)$/.exec(key);
  if (!match) return null;
  const plan = PLANS.find((candidate) => candidate.id === match[1]);
  if (!plan) return null;
  return { planId: plan.id, cycle: match[2] === "annual" ? "ANNUAL" : "MONTHLY" };
}

/** The one-time "$1 first month" promotion, created by the setup script. */
export function introCouponId(planId: PlanId): string {
  return `halyard_intro_${planId}`;
}

/**
 * Stripe Tax on Halyard's own sales (plans and themes). Off until
 * STRIPE_TAX_ENABLED=true, which should only follow enabling Stripe Tax in the
 * Stripe dashboard with an origin address and at least one registration —
 * otherwise Stripe rejects the session. Calculation and collection only: Stripe
 * Tax does not register, file or remit for us.
 */
export function isStripeTaxEnabled(): boolean {
  return /^(1|true|yes)$/i.test(process.env.STRIPE_TAX_ENABLED?.trim() ?? "");
}
