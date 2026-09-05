import { NextResponse } from "next/server";
import { rejectCrossOrigin } from "@/lib/request-origin";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiContext } from "@/lib/services/context";
import { can } from "@/lib/permissions";
import { getPlan, isPlanId } from "@/lib/plans";
import { getStripe, introCouponId, isStripeBillingConfigured, isStripeTaxEnabled, priceLookupKey } from "@/lib/stripe";

export const runtime = "nodejs";

const bodySchema = z.object({
  planId: z.string(),
  cycle: z.enum(["MONTHLY", "ANNUAL"]),
});

/**
 * Starts a Stripe Checkout session for a paid plan. The webhook — not this
 * route — is what actually changes the organization's plan, so an abandoned
 * checkout changes nothing.
 */
export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const ctx = await apiContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(ctx.role, "billing:manage")) {
    return NextResponse.json({ error: "Only an owner can manage billing." }, { status: 403 });
  }
  if (!isStripeBillingConfigured()) {
    return NextResponse.json({ error: "Billing is not connected yet." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPlanId(parsed.data.planId)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  const plan = getPlan(parsed.data.planId);
  if (plan.monthly === 0) {
    return NextResponse.json({ error: "The free plan has no checkout." }, { status: 400 });
  }

  const stripe = getStripe();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });

  const prices = await stripe.prices.list({
    lookup_keys: [priceLookupKey(plan.id, parsed.data.cycle)],
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    return NextResponse.json(
      { error: "Billing prices are not set up yet. Run scripts/stripe-setup.ts." },
      { status: 503 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const firstSubscription = !org.stripeCustomerId;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: org.stripeCustomerId ?? undefined,
    client_reference_id: org.id,
    line_items: [{ price: price.id, quantity: 1 }],
    // The $1-first-month promotion applies once, to a first monthly subscription.
    discounts:
      firstSubscription && parsed.data.cycle === "MONTHLY" && plan.introFirstMonth !== null
        ? [{ coupon: introCouponId(plan.id) }]
        : undefined,
    subscription_data: { metadata: { organizationId: org.id } },
    // Halyard's own sales tax/VAT, calculated by Stripe Tax where a
    // registration exists. Requires a billing address; an existing customer's
    // address is refreshed from the session.
    ...(isStripeTaxEnabled()
      ? {
          automatic_tax: { enabled: true },
          billing_address_collection: "required" as const,
          ...(org.stripeCustomerId ? { customer_update: { address: "auto" as const } } : {}),
        }
      : {}),
    success_url: `${appUrl}/admin/settings/billing?checkout=success`,
    cancel_url: `${appUrl}/admin/settings/billing?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
