/**
 * Creates Halyard's products, prices, and intro coupons in the Stripe account
 * behind STRIPE_SECRET_KEY. Idempotent — safe to re-run; existing objects are
 * kept. Run once against test mode, again against live mode when ready:
 *
 *   npx tsx scripts/stripe-setup.ts
 */
import "dotenv/config";
import Stripe from "stripe";
import { PLANS } from "../src/lib/plans";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Set STRIPE_SECRET_KEY in .env first.");
  const stripe = new Stripe(key);
  const mode = key.startsWith("sk_live") ? "LIVE" : "test";
  console.log(`Setting up Halyard billing objects in ${mode} mode…`);

  for (const plan of PLANS) {
    if (plan.monthly === 0) continue;

    const productId = `halyard_${plan.id}`;
    let product: Stripe.Product;
    try {
      product = await stripe.products.retrieve(productId);
      console.log(`· product ${productId} exists`);
    } catch {
      product = await stripe.products.create({
        id: productId,
        name: `Halyard ${plan.name}`,
        description: plan.tagline,
      });
      console.log(`✓ created product ${productId}`);
    }

    for (const [cycle, monthlyPrice] of [
      ["monthly", plan.monthly],
      ["annual", plan.annualMonthly],
    ] as const) {
      const lookupKey = `halyard_${plan.id}_${cycle}`;
      const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
      if (existing.data.length) {
        console.log(`· price ${lookupKey} exists`);
        continue;
      }
      await stripe.prices.create({
        product: product.id,
        lookup_key: lookupKey,
        currency: "usd",
        recurring: { interval: cycle === "annual" ? "year" : "month" },
        unit_amount: cycle === "annual" ? monthlyPrice * 12 * 100 : monthlyPrice * 100,
        nickname: `${plan.name} ${cycle}`,
      });
      console.log(`✓ created price ${lookupKey}`);
    }

    if (plan.introFirstMonth !== null) {
      const couponId = `halyard_intro_${plan.id}`;
      try {
        await stripe.coupons.retrieve(couponId);
        console.log(`· coupon ${couponId} exists`);
      } catch {
        await stripe.coupons.create({
          id: couponId,
          duration: "once",
          amount_off: (plan.monthly - plan.introFirstMonth) * 100,
          currency: "usd",
          name: `${plan.name} — first month $${plan.introFirstMonth}`,
        });
        console.log(`✓ created coupon ${couponId}`);
      }
    }
  }

  console.log("\nDone. Next: set STRIPE_WEBHOOK_SECRET from your webhook endpoint");
  console.log("(Dashboard → Developers → Webhooks → add <app-url>/api/billing/webhook,");
  console.log(" events: checkout.session.completed, customer.subscription.*)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
