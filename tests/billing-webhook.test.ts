import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { recordThemePurchase } from "@/lib/services/themes";

/**
 * The Stripe webhook with the SDK mocked: signature verification is replaced by
 * a fake constructEventAsync, so the handler's own behaviour — idempotency,
 * failed-payment flagging, refund reversal — is what is under test.
 */
let organizationId: string;
let userId: string;
const events: Array<Record<string, unknown>> = [];

vi.mock("@/lib/stripe", () => ({
  isStripeBillingConfigured: () => true,
  isStripeTaxEnabled: () => false,
  planFromLookupKey: () => null,
  getStripe: () => ({ webhooks: { constructEventAsync: async () => events.shift() } }),
}));

async function post(event: Record<string, unknown>) {
  events.push(event);
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_not_real";
  const { POST } = await import("@/app/api/billing/webhook/route");
  return POST(new Request("http://localhost/api/billing/webhook", { method: "POST", headers: { "stripe-signature": "t=1,v1=fake" }, body: "{}" }));
}

beforeAll(async () => {
  const setup = await createTestStore("webhook");
  organizationId = setup.organization.id;
  userId = setup.user.id;
  await testDb.organization.update({ where: { id: organizationId }, data: { stripeSubscriptionId: `sub_test_${Date.now()}` } });
});

afterAll(async () => {
  await testDb.webhookEvent.deleteMany({ where: { id: { startsWith: "evt_test_" } } });
  await cleanupTestStore(organizationId, userId);
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("Stripe webhook", () => {
  it("applies an event once and acknowledges a redelivery without applying it again", async () => {
    const org = await testDb.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const event = {
      id: `evt_test_${Date.now()}_a`,
      type: "invoice.payment_failed",
      data: { object: { subscription: org.stripeSubscriptionId } },
    };
    const first = await post(event);
    expect(first.status).toBe(200);
    expect((await testDb.organization.findUniqueOrThrow({ where: { id: organizationId } })).planStatus).toBe("PAST_DUE");

    await testDb.organization.update({ where: { id: organizationId }, data: { planStatus: "ACTIVE" } });
    const second = await post(event);
    expect(await second.json()).toMatchObject({ duplicate: true });
    expect((await testDb.organization.findUniqueOrThrow({ where: { id: organizationId } })).planStatus).toBe("ACTIVE");
  });

  it("a refunded charge removes the theme entitlement it paid for", async () => {
    const paymentIntent = `pi_test_${Date.now()}`;
    await recordThemePurchase({ organizationId, themeId: "monolith", amountCents: 1500, currency: "usd", stripeSessionId: `cs_test_${Date.now()}`, stripePaymentIntentId: paymentIntent });
    const response = await post({
      id: `evt_test_${Date.now()}_b`,
      type: "charge.refunded",
      data: { object: { payment_intent: paymentIntent, refunded: true } },
    });
    expect(response.status).toBe(200);
    const purchase = await testDb.themePurchase.findFirst({ where: { organizationId, themeId: "monolith" } });
    expect(purchase?.status).toBe("REFUNDED");
  });
});
