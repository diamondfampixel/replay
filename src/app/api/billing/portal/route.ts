import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiContext } from "@/lib/services/context";
import { can } from "@/lib/permissions";
import { getStripe, isStripeBillingConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

/** Opens Stripe's hosted portal: payment method, invoices, cancellation. */
export async function POST() {
  const ctx = await apiContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(ctx.role, "billing:manage")) {
    return NextResponse.json({ error: "Only an owner can manage billing." }, { status: 403 });
  }
  if (!isStripeBillingConfigured()) {
    return NextResponse.json({ error: "Billing is not connected yet." }, { status: 503 });
  }

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
  if (!org.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account exists yet." }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await getStripe().billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${appUrl}/admin/settings/billing`,
  });
  return NextResponse.json({ url: session.url });
}
