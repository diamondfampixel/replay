import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { clearTestCookies } from "./setup";
import { createProduct } from "@/lib/services/products";
import { createCollection } from "@/lib/services/collections";
import { createDiscount } from "@/lib/services/discounts";
import { addToCart, applyCartDiscount, getCartView, removeCartItem, updateCartItem } from "@/lib/services/cart";
import { createOrder, refundOrder, cancelOrder, fulfillOrder } from "@/lib/services/orders";
import type { ServiceContext } from "@/lib/services/context";

let ctx: ServiceContext;
let organizationId: string;
let userId: string;
let productId: string;
let variantIds: string[];
let cheapProductId: string;

beforeAll(async () => {
  const setup = await createTestStore("cart");
  ctx = setup.ctx;
  organizationId = setup.organization.id;
  userId = setup.user.id;

  const product = await createProduct(ctx, {
    title: "Cart Hoodie",
    status: "ACTIVE",
    price: 50,
    trackInventory: true,
    variants: [
      { title: "S", options: { Size: "S" }, inventory: 3 },
      { title: "M", options: { Size: "M" }, inventory: 10 },
    ],
  });
  productId = product.id;
  variantIds = product.variants.map((variant) => variant.id);

  const cheap = await createProduct(ctx, {
    title: "Cart Mug",
    status: "ACTIVE",
    price: 20,
    trackInventory: true,
    inventory: 100,
  });
  cheapProductId = cheap.id;
});

afterAll(async () => {
  await cleanupTestStore(organizationId, userId);
});

beforeEach(() => {
  clearTestCookies();
});

describe("cart", () => {
  it("adds an item, prices it and totals it", async () => {
    await addToCart(ctx.storeId, productId, variantIds[1], 2);
    const cart = await getCartView(ctx.storeId);

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
    expect(cart.items[0].unitPrice).toBe(50);
    expect(cart.subtotal).toBe(100);
    // $100 clears the $75 free-shipping threshold.
    expect(cart.shipping).toBe(0);
    expect(cart.total).toBe(100);
  });

  it("charges shipping below the free threshold", async () => {
    await addToCart(ctx.storeId, cheapProductId, null, 1);
    const cart = await getCartView(ctx.storeId);
    expect(cart.subtotal).toBe(20);
    expect(cart.shipping).toBeGreaterThan(0);
    expect(cart.total).toBe(20 + cart.shipping);
  });

  it("merges repeat adds of the same variant", async () => {
    await addToCart(ctx.storeId, productId, variantIds[1], 1);
    await addToCart(ctx.storeId, productId, variantIds[1], 2);
    const cart = await getCartView(ctx.storeId);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
  });

  it("keeps separate lines for different variants", async () => {
    await addToCart(ctx.storeId, productId, variantIds[0], 1);
    await addToCart(ctx.storeId, productId, variantIds[1], 1);
    const cart = await getCartView(ctx.storeId);
    expect(cart.items).toHaveLength(2);
  });

  it("refuses to exceed available stock", async () => {
    await addToCart(ctx.storeId, productId, variantIds[0], 3);
    await expect(addToCart(ctx.storeId, productId, variantIds[0], 1)).rejects.toThrow(/only 3 left/i);
  });

  it("requires an option when the product has variants", async () => {
    await expect(addToCart(ctx.storeId, productId, null, 1)).rejects.toThrow(/choose an option/i);
  });

  it("updates and removes lines", async () => {
    await addToCart(ctx.storeId, cheapProductId, null, 2);
    let cart = await getCartView(ctx.storeId);
    const itemId = cart.items[0].id;

    await updateCartItem(ctx.storeId, itemId, 5);
    cart = await getCartView(ctx.storeId);
    expect(cart.items[0].quantity).toBe(5);

    await removeCartItem(ctx.storeId, itemId);
    cart = await getCartView(ctx.storeId);
    expect(cart.items).toHaveLength(0);
  });
});

describe("discounts at checkout", () => {
  it("applies a percentage code", async () => {
    await createDiscount(ctx, {
      title: "Twenty off", code: "TWENTY", type: "PERCENTAGE",
      status: "ACTIVE", value: 20,
    });

    await addToCart(ctx.storeId, cheapProductId, null, 5); // $100
    const applied = await applyCartDiscount(ctx.storeId, "TWENTY");
    expect(applied.ok).toBe(true);

    const cart = await getCartView(ctx.storeId);
    expect(cart.subtotal).toBe(100);
    expect(cart.discountTotal).toBe(20);
    expect(cart.total).toBe(80);
  });

  it("enforces a minimum purchase", async () => {
    await createDiscount(ctx, {
      title: "Big spender", code: "BIG50", type: "FIXED_AMOUNT",
      status: "ACTIVE", value: 50, minPurchase: 200,
    });

    await addToCart(ctx.storeId, cheapProductId, null, 2); // $40
    const result = await applyCartDiscount(ctx.storeId, "BIG50");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/spend at least/i);
  });

  it("scopes a discount to a collection", async () => {
    const collection = await createCollection(ctx, {
      title: "Discounted set", type: "MANUAL", productIds: [cheapProductId],
    });
    await createDiscount(ctx, {
      title: "Mug sale", code: "MUGS", type: "PERCENTAGE", status: "ACTIVE", value: 50,
      appliesToScope: "collections", collectionIds: [collection.id],
    });

    // Only the mug qualifies, so the hoodie's value is untouched.
    await addToCart(ctx.storeId, cheapProductId, null, 1); // $20
    await addToCart(ctx.storeId, productId, variantIds[1], 1); // $50
    await applyCartDiscount(ctx.storeId, "MUGS");

    const cart = await getCartView(ctx.storeId);
    expect(cart.subtotal).toBe(70);
    expect(cart.discountTotal).toBe(10); // 50% of the $20 mug only
  });

  it("rejects an expired code", async () => {
    await createDiscount(ctx, {
      title: "Gone", code: "EXPIRED1", type: "PERCENTAGE", status: "ACTIVE", value: 10,
      startsAt: new Date(Date.now() - 2 * 864e5),
      endsAt: new Date(Date.now() - 864e5),
    });
    await addToCart(ctx.storeId, cheapProductId, null, 1);
    const result = await applyCartDiscount(ctx.storeId, "EXPIRED1");
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown code", async () => {
    await addToCart(ctx.storeId, cheapProductId, null, 1);
    const result = await applyCartDiscount(ctx.storeId, "NOPE");
    expect(result.ok).toBe(false);
  });

  it("applies free shipping", async () => {
    await createDiscount(ctx, {
      title: "Ship free", code: "SHIPFREE", type: "FREE_SHIPPING", status: "ACTIVE", value: 0,
    });
    await addToCart(ctx.storeId, cheapProductId, null, 1); // $20, normally charges shipping
    await applyCartDiscount(ctx.storeId, "SHIPFREE");
    const cart = await getCartView(ctx.storeId);
    expect(cart.shipping).toBe(0);
    expect(cart.total).toBe(20);
  });
});

describe("orders", () => {
  it("creates an order, decrements inventory and records a timeline", async () => {
    const before = await testDb.productVariant.findUniqueOrThrow({ where: { id: variantIds[1] } });

    const order = await createOrder(ctx, {
      email: "buyer@example.test",
      lines: [{ productId, variantId: variantIds[1], quantity: 2 }],
      shippingTotal: 0,
      taxTotal: 0,
    });

    expect(Number(order.total)).toBe(100);
    expect(order.paymentStatus).toBe("PAID");
    expect(order.fulfillmentStatus).toBe("UNFULFILLED");

    const after = await testDb.productVariant.findUniqueOrThrow({ where: { id: variantIds[1] } });
    expect(after.inventory).toBe(before.inventory - 2);

    const events = await testDb.orderEvent.findMany({ where: { orderId: order.id } });
    expect(events.map((event) => event.type)).toContain("created");
    expect(events.map((event) => event.type)).toContain("paid");

    const payments = await testDb.payment.findMany({ where: { orderId: order.id } });
    expect(payments[0].provider).toBe("simulated");
  });

  it("numbers orders sequentially per store", async () => {
    const first = await createOrder(ctx, {
      email: "a@example.test", lines: [{ productId: cheapProductId, quantity: 1 }],
    });
    const second = await createOrder(ctx, {
      email: "b@example.test", lines: [{ productId: cheapProductId, quantity: 1 }],
    });
    expect(second.number).toBe(first.number + 1);
  });

  it("applies a discount amount to the order total", async () => {
    const order = await createOrder(ctx, {
      email: "c@example.test",
      lines: [{ productId: cheapProductId, quantity: 5 }],
      discountAmount: 25,
      shippingTotal: 5,
      taxTotal: 3,
    });
    expect(Number(order.subtotal)).toBe(100);
    expect(Number(order.total)).toBe(100 - 25 + 5 + 3);
  });

  it("refunds partially then fully", async () => {
    const order = await createOrder(ctx, {
      email: "refund@example.test", lines: [{ productId: cheapProductId, quantity: 5 }],
    });
    const total = Number(order.total);

    const partial = await refundOrder(ctx, order.id, 20, "Damaged in transit");
    expect(partial.paymentStatus).toBe("PARTIALLY_REFUNDED");
    expect(Number(partial.refundedTotal)).toBe(20);

    const full = await refundOrder(ctx, order.id);
    expect(full.paymentStatus).toBe("REFUNDED");
    expect(Number(full.refundedTotal)).toBe(total);

    await expect(refundOrder(ctx, order.id, 5)).rejects.toThrow(/already been fully refunded/i);
  });

  it("returns stock when cancelling an unfulfilled order", async () => {
    const before = await testDb.product.findUniqueOrThrow({ where: { id: cheapProductId } });
    const order = await createOrder(ctx, {
      email: "cancel@example.test", lines: [{ productId: cheapProductId, quantity: 3 }],
    });
    const afterOrder = await testDb.product.findUniqueOrThrow({ where: { id: cheapProductId } });
    expect(afterOrder.inventory).toBe(before.inventory - 3);

    await cancelOrder(ctx, order.id, "Customer changed their mind");
    const afterCancel = await testDb.product.findUniqueOrThrow({ where: { id: cheapProductId } });
    expect(afterCancel.inventory).toBe(before.inventory);

    await expect(fulfillOrder(ctx, order.id)).rejects.toThrow(/cancelled/i);
  });

  it("records fulfillment and tracking on the timeline", async () => {
    const order = await createOrder(ctx, {
      email: "ship@example.test", lines: [{ productId: cheapProductId, quantity: 1 }],
    });
    await fulfillOrder(ctx, order.id, { trackingNumber: "TRACK123", carrier: "UPS" });

    const updated = await testDb.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { events: true },
    });
    expect(updated.fulfillmentStatus).toBe("FULFILLED");
    expect(updated.trackingNumber).toBe("TRACK123");
    expect(updated.events.some((event) => event.type === "tracking")).toBe(true);
  });

  it("refuses an order referencing another store's product", async () => {
    const other = await createTestStore("cart-isolation");
    const foreign = await createProduct(other.ctx, { title: "Foreign", price: 10, status: "ACTIVE" });

    await expect(
      createOrder(ctx, { email: "x@example.test", lines: [{ productId: foreign.id, quantity: 1 }] }),
    ).rejects.toThrow(/no longer available/i);

    await cleanupTestStore(other.organization.id, other.user.id);
  });
});
