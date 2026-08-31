import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { clearTestCookies } from "./setup";
import { createProduct } from "@/lib/services/products";
import { createCollection } from "@/lib/services/collections";
import { createDiscount } from "@/lib/services/discounts";
import { createExperiment, recordExperimentEvent, setExperimentStatus, getExperimentResults } from "@/lib/services/experiments";
import { ensureHomepage } from "@/lib/services/provision";
import { getProductCards, getStore } from "@/lib/storefront/data";
import { addToCart, applyCartDiscount, getCartView } from "@/lib/services/cart";
import { createOrder } from "@/lib/services/orders";
import { resolveCustomerForCheckout } from "@/lib/services/customers";
import { trackEvent } from "@/lib/services/events";
import { recordConversions } from "@/lib/services/experiments";
import { getOverviewMetrics, getTopProducts } from "@/lib/services/analytics";
import { resolveRange } from "@/lib/ranges";
import { executeTool, confirmPendingAction } from "@/lib/ai/executor";
import { toNumber } from "@/lib/money";
import type { ServiceContext } from "@/lib/services/context";

/**
 * The interconnectedness claim, proven end to end.
 *
 * A product created through the AI flows all the way to a purchase, and that
 * purchase moves inventory, analytics, customer history and experiment results.
 */

let ctx: ServiceContext;
let organizationId: string;
let userId: string;
let storeSlug: string;

beforeAll(async () => {
  const setup = await createTestStore("connected");
  ctx = setup.ctx;
  organizationId = setup.organization.id;
  userId = setup.user.id;
  storeSlug = setup.store.slug;
  await ensureHomepage(testDb, ctx.storeId);
  clearTestCookies();
});

afterAll(async () => {
  await cleanupTestStore(organizationId, userId);
});

describe("product created by the AI reaches a real purchase", () => {
  let productId: string;
  let variantId: string;
  let collectionId: string;
  let experimentId: string;
  let sessionId: string;
  let orderId: string;
  let customerId: string;

  it("1. the assistant creates the product as a draft", async () => {
    const outcome = await executeTool(
      "create_product",
      {
        title: "Connected Hoodie",
        price: 80,
        description: "A hoodie that proves the whole loop works.",
        tags: ["core"],
        options: [{ name: "Size", values: ["S", "M", "L"] }],
      },
      { ...ctx, actor: "ai" },
    );
    expect(outcome.status).toBe("executed");
    if (outcome.status !== "executed") return;

    productId = (outcome.result.data as { productId: string }).productId;
    const product = await testDb.product.findUniqueOrThrow({
      where: { id: productId },
      include: { variants: true },
    });
    expect(product.status).toBe("DRAFT");
    expect(product.variants).toHaveLength(3);
    // The assistant reports what is still missing rather than claiming it is done.
    expect(outcome.result.summary).toMatch(/images/i);
  });

  it("2. stock is set and it is published — with confirmation", async () => {
    const product = await testDb.product.findUniqueOrThrow({
      where: { id: productId },
      include: { variants: { orderBy: { position: "asc" } } },
    });
    variantId = product.variants[1].id;

    for (const variant of product.variants) {
      const setStock = await executeTool(
        "set_inventory",
        { productId, variantId: variant.id, quantity: 10 },
        { ...ctx, actor: "ai" },
      );
      expect(setStock.status).toBe("executed");
    }

    // Publishing touches the live store, so it must ask first.
    const pending = await executeTool(
      "set_product_status",
      { productIds: [productId], status: "ACTIVE" },
      { ...ctx, actor: "ai" },
    );
    expect(pending.status).toBe("needs_confirmation");
    if (pending.status !== "needs_confirmation") return;

    const confirmed = await confirmPendingAction(pending.actionId, ctx);
    expect(confirmed.status).toBe("executed");

    const published = await testDb.product.findUniqueOrThrow({ where: { id: productId } });
    expect(published.status).toBe("ACTIVE");
    expect(published.inventory).toBe(30);
  });

  it("3. it appears in a collection and on the storefront", async () => {
    const collection = await createCollection(ctx, {
      title: "Connected Picks",
      type: "MANUAL",
      productIds: [productId],
    });
    collectionId = collection.id;

    const store = await getStore(storeSlug);
    const cards = await getProductCards(store.id, {
      source: "collection",
      collectionSlug: collection.slug,
      limit: 10,
    });
    expect(cards.map((card) => card.id)).toContain(productId);
    expect(cards.find((card) => card.id === productId)?.inStock).toBe(true);
  });

  it("4. a running experiment assigns this shopper a variant", async () => {
    const experiment = await createExperiment(ctx, {
      name: "Connected hoodie title",
      testType: "product_title",
      targetType: "product",
      productId,
      goal: "purchase",
      variants: [
        { name: "A", isControl: true, weight: 50, changes: { title: "Connected Hoodie" } },
        { name: "B", weight: 50, changes: { title: "The Connected Hoodie" } },
      ],
    });
    experimentId = experiment.id;
    await setExperimentStatus(ctx, experimentId, "RUNNING");

    sessionId = "connected-session";
    await recordExperimentEvent({
      experimentId,
      variantId: experiment.variants[0].id,
      sessionId,
      type: "impression",
    });

    const results = await getExperimentResults(experimentId);
    expect(results.totalVisitors).toBe(1);
    // One visitor is nowhere near enough to call anything.
    expect(results.significant).toBe(false);
  });

  it("5. browsing is recorded as analytics events", async () => {
    await trackEvent({ storeId: ctx.storeId, type: "page_view", sessionId, path: "/" });
    await trackEvent({ storeId: ctx.storeId, type: "product_view", sessionId, productId });
    await trackEvent({ storeId: ctx.storeId, type: "add_to_cart", sessionId, productId, value: 80 });

    const today = new Date();
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const rollup = await testDb.analyticsDaily.findUniqueOrThrow({
      where: { storeId_date: { storeId: ctx.storeId, date } },
    });
    expect(rollup.sessions).toBe(1);
    expect(rollup.productViews).toBe(1);
    expect(rollup.addToCarts).toBe(1);
  });

  it("6. the cart prices it and applies a discount the AI created", async () => {
    const discount = await executeTool(
      "create_discount",
      {
        title: "Connected launch",
        code: "CONNECT25",
        type: "PERCENTAGE",
        value: 25,
        scope: "collections",
        collectionIds: [collectionId],
      },
      { ...ctx, actor: "ai" },
    );
    expect(discount.status).toBe("executed");
    // Created as a draft, so it is not usable yet.
    await testDb.discount.updateMany({
      where: { storeId: ctx.storeId, code: "CONNECT25" },
      data: { status: "ACTIVE" },
    });

    await addToCart(ctx.storeId, productId, variantId, 2);
    const applied = await applyCartDiscount(ctx.storeId, "CONNECT25");
    expect(applied.ok).toBe(true);

    const cart = await getCartView(ctx.storeId);
    expect(cart.subtotal).toBe(160);
    expect(cart.discountTotal).toBe(40);
    expect(cart.shipping).toBe(0); // over the free-shipping threshold
    expect(cart.total).toBe(120);
  });

  it("7. checkout creates an order and moves inventory", async () => {
    const cart = await getCartView(ctx.storeId);
    const customer = await resolveCustomerForCheckout(
      ctx.storeId,
      "shopper@example.test",
      { firstName: "Connected", lastName: "Shopper" },
      true,
    );
    customerId = customer.id;

    const order = await createOrder(ctx, {
      email: "shopper@example.test",
      customerId: customer.id,
      lines: cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
      discountCode: "CONNECT25",
      discountAmount: cart.discountTotal,
      shippingTotal: cart.shipping,
      taxTotal: cart.tax,
      source: "google",
    });
    orderId = order.id;

    expect(toNumber(order.total)).toBe(120);
    expect(order.paymentStatus).toBe("PAID");

    const variant = await testDb.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.inventory).toBe(8);
    const product = await testDb.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.inventory).toBe(28);

    // The discount records its use.
    const discount = await testDb.discount.findFirstOrThrow({
      where: { storeId: ctx.storeId, code: "CONNECT25" },
    });
    expect(discount.usageCount).toBe(1);
  });

  it("8. the purchase converts the experiment the shopper was in", async () => {
    await recordConversions(ctx.storeId, sessionId, "purchase", { orderId, value: 120 });

    const results = await getExperimentResults(experimentId);
    expect(results.totalConversions).toBe(1);
    const arm = results.variants.find((variant) => variant.conversions === 1)!;
    expect(arm.revenue).toBe(120);
    expect(arm.conversionRate).toBe(100);
    // Still refuses to call a winner on one visitor.
    expect(results.significant).toBe(false);
    expect(results.readiness).toMatch(/visitors per variant/i);
  });

  it("9. it shows up in analytics and top products", async () => {
    const range = resolveRange("30d");
    const metrics = await getOverviewMetrics(ctx.storeId, range);
    expect(metrics.orders.value).toBe(1);
    expect(metrics.revenue.value).toBe(120);
    expect(metrics.unitsSold.value).toBe(2);

    const top = await getTopProducts(ctx.storeId, range, 5);
    expect(top[0].id).toBe(productId);
    expect(top[0].units).toBe(2);
    expect(top[0].revenue).toBe(160); // line total before the order-level discount
  });

  it("10. it appears in the customer's history", async () => {
    const customer = await testDb.customer.findUniqueOrThrow({
      where: { id: customerId },
      include: { orders: { include: { items: true } } },
    });
    expect(customer.orders).toHaveLength(1);
    expect(customer.orders[0].items[0].productId).toBe(productId);
    expect(customer.acceptsMarketing).toBe(true);
  });

  it("11. a notification and an audit trail were produced", async () => {
    const notifications = await testDb.notification.findMany({
      where: { storeId: ctx.storeId, type: "new_order" },
    });
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0].href).toBe(`/admin/orders/${orderId}`);

    const aiActions = await testDb.aIAction.findMany({
      where: { storeId: ctx.storeId, status: "EXECUTED" },
    });
    expect(aiActions.map((action) => action.tool)).toContain("create_product");
    expect(aiActions.map((action) => action.tool)).toContain("set_product_status");

    const audits = await testDb.auditLog.findMany({
      where: { organizationId, actor: "ai" },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("12. the AI can then read back what happened", async () => {
    const overview = await executeTool("get_store_overview", { range: "30d" }, { ...ctx, actor: "ai" });
    expect(overview.status).toBe("executed");
    if (overview.status !== "executed") return;
    expect(overview.result.summary).toContain("$120.00");

    const experiment = await executeTool("list_ab_tests", {}, { ...ctx, actor: "ai" });
    if (experiment.status !== "executed") return;
    const tests = experiment.result.data as Array<{ statisticallySignificant: boolean; readiness: string }>;
    // The tool hands the model the honest read, not just a leader.
    expect(tests[0].statisticallySignificant).toBe(false);
    expect(tests[0].readiness).toBeTruthy();
  });
});
