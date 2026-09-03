import { NextResponse } from "next/server";
import { recordThemePurchase } from "@/lib/services/themes";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/monitoring";
import { getStripe, isStripeBillingConfigured, planFromLookupKey } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe is the source of truth for paid subscriptions; this webhook is the
 * only writer of Stripe-derived state. Every event is signature-verified —
 * an unsigned or mis-signed body changes nothing.
 */
export async function POST(request: Request) {
  if (!isStripeBillingConfigured()) {
    return NextResponse.json({ error: "Billing is not connected." }, { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[billing/webhook] STRIPE_WEBHOOK_SECRET is not set; rejecting event");
    return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const organizationId = session.client_reference_id;
        // One-time theme purchase: record ownership from the verified event only.
        if (session.mode === "payment" && session.metadata?.kind === "theme" && session.metadata.themeId && session.metadata.organizationId && session.payment_status === "paid") {
          await recordThemePurchase({
            organizationId: session.metadata.organizationId,
            themeId: session.metadata.themeId,
            amountCents: session.amount_total ?? 0,
            currency: session.currency ?? "usd",
            stripeSessionId: session.id,
            stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
          });
        }
        if (organizationId && typeof session.customer === "string") {
          await prisma.organization.update({
            where: { id: organizationId },
            data: { stripeCustomerId: session.customer },
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const organizationId = subscription.metadata?.organizationId;
        if (!organizationId) break;

        const item = subscription.items.data[0];
        const resolved = planFromLookupKey(item?.price?.lookup_key);
        const status =
          subscription.status === "trialing"
            ? ("TRIALING" as const)
            : subscription.status === "past_due" || subscription.status === "unpaid"
              ? ("PAST_DUE" as const)
              : subscription.status === "canceled"
                ? ("CANCELED" as const)
                : ("ACTIVE" as const);

        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            stripeSubscriptionId: subscription.id,
            ...(typeof subscription.customer === "string"
              ? { stripeCustomerId: subscription.customer }
              : {}),
            ...(resolved ? { plan: resolved.planId, billingCycle: resolved.cycle } : {}),
            planStatus: status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodEnd: item?.current_period_end
              ? new Date(item.current_period_end * 1000)
              : null,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const organizationId = subscription.metadata?.organizationId;
        if (!organizationId) break;
        // A lapsed subscription lands on the free tier, not in limbo.
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            plan: "harbor",
            planStatus: "CANCELED",
            stripeSubscriptionId: null,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
          },
        });
        break;
      }

      case "charge.refunded": {
        // A refunded theme purchase loses its entitlement; the row stays for
        // the books. Subscription refunds change nothing here — the
        // subscription events above own plan state.
        const charge = event.data.object;
        const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
        if (paymentIntent && charge.refunded) {
          await prisma.themePurchase.updateMany({
            where: { stripePaymentIntentId: paymentIntent, status: "PAID" },
            data: { status: "REFUNDED" },
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    reportError("billing/webhook", error, { eventType: event.type });
    // 500 makes Stripe retry, which is what we want for a transient DB fault.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
