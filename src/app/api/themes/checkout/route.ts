import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiContext } from "@/lib/services/context";
import { can } from "@/lib/permissions";
import { getStripe, isStripeBillingConfigured } from "@/lib/stripe";
import { getCatalogTheme, themePriceCents } from "@/lib/storefront/themes";
import { isThemeEntitled } from "@/lib/services/themes";

export const runtime = "nodejs";

const bodySchema = z.object({ themeId: z.string().max(60) });

/**
 * Starts a Stripe Checkout session (payment mode) for one premium theme. The
 * signed webhook — not this route — records the purchase, so an abandoned
 * checkout grants nothing. Prices come from the catalogue, never the client.
 */
export async function POST(request: Request) {
  const ctx = await apiContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(ctx.role, "billing:manage")) {
    return NextResponse.json({ error: "Only an owner can buy themes." }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const theme = parsed.success ? getCatalogTheme(parsed.data.themeId) : undefined;
  if (!theme) return NextResponse.json({ error: "Unknown theme" }, { status: 400 });
  if (theme.tier === "included") return NextResponse.json({ error: "This theme is included on every plan." }, { status: 400 });
  if (await isThemeEntitled(ctx.organizationId, theme)) {
    return NextResponse.json({ error: "You already own this theme." }, { status: 409 });
  }
  if (!isStripeBillingConfigured()) {
    return NextResponse.json({ error: "Theme purchases are not connected yet — payments are not configured on this deployment." }, { status: 503 });
  }

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer: org.stripeCustomerId ?? undefined,
    client_reference_id: org.id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: themePriceCents(theme),
        product_data: { name: `Halyard theme: ${theme.name}`, description: theme.tagline },
      },
    }],
    metadata: { kind: "theme", themeId: theme.id, organizationId: org.id },
    success_url: `${appUrl}/admin/store/themes?purchase=success&theme=${theme.id}`,
    cancel_url: `${appUrl}/admin/store/themes?purchase=cancelled`,
  });
  return NextResponse.json({ url: session.url });
}
