"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, fromZodError, guard, ok } from "@/lib/action-result";
import {
  addToCart, applyCartDiscount, emptyCart, getCart, getCartView, removeCartItem, updateCartItem,
} from "@/lib/services/cart";
import { checkoutSchema } from "@/lib/validation/commerce";
import { createOrder } from "@/lib/services/orders";
import { resolveCustomerForCheckout } from "@/lib/services/customers";
import { classifyDevice, classifySource, trackEvent } from "@/lib/services/events";
import { recordConversions } from "@/lib/services/experiments";
import { rateLimit } from "@/lib/rate-limit";
import type { ServiceContext } from "@/lib/services/context";

async function storeBySlug(slug: string) {
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, organizationId: true, currency: true, status: true, settings: true },
  });
  if (!store || store.status === "DRAFT") throw new Error("This store is not available.");
  return store;
}

/**
 * A paused store stays readable so shoppers see why, but it must not take
 * money. The admin's pause control says "Store paused"; without this it only
 * changed a badge while checkout carried on working.
 */
function assertAcceptingOrders(store: { status: string }) {
  if (store.status !== "ACTIVE") {
    throw new Error("This store is not accepting orders right now.");
  }
}

/** Storefront actions run as the system, not as a signed-in admin. */
function systemContext(store: { id: string; organizationId: string }): ServiceContext {
  return {
    storeId: store.id,
    organizationId: store.organizationId,
    userId: null,
    role: "OWNER",
    actor: "system",
  };
}

export async function addToCartAction(
  storeSlug: string,
  productId: string,
  variantId: string | null,
  quantity: number,
  sessionId?: string,
) {
  return guard(async () => {
    const store = await storeBySlug(storeSlug);
    assertAcceptingOrders(store);
    await addToCart(store.id, productId, variantId, quantity);

    if (sessionId) {
      const headerList = await headers();
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { price: true } });
      await trackEvent({
        storeId: store.id,
        type: "add_to_cart",
        sessionId,
        productId,
        device: classifyDevice(headerList.get("user-agent")),
        value: product ? Number(product.price) : null,
      }).catch(() => undefined);
      await recordConversions(store.id, sessionId, "add_to_cart").catch(() => undefined);
    }

    const cart = await getCartView(store.id);
    revalidatePath(`/s/${storeSlug}`, "layout");
    return ok(cart, "Added to cart");
  });
}

export async function updateCartItemAction(storeSlug: string, itemId: string, quantity: number) {
  return guard(async () => {
    const store = await storeBySlug(storeSlug);
    assertAcceptingOrders(store);
    await updateCartItem(store.id, itemId, quantity);
    revalidatePath(`/s/${storeSlug}`, "layout");
    return ok(await getCartView(store.id));
  });
}

export async function removeCartItemAction(storeSlug: string, itemId: string) {
  return guard(async () => {
    const store = await storeBySlug(storeSlug);
    await removeCartItem(store.id, itemId);
    revalidatePath(`/s/${storeSlug}`, "layout");
    return ok(await getCartView(store.id));
  });
}

export async function applyDiscountAction(storeSlug: string, code: string | null) {
  return guard(async () => {
    const store = await storeBySlug(storeSlug);
    const result = await applyCartDiscount(store.id, code);
    if (!result.ok) return fail(result.reason);
    revalidatePath(`/s/${storeSlug}`, "layout");
    return ok(await getCartView(store.id), code ? "Discount applied" : "Discount removed");
  });
}

export async function getCartAction(storeSlug: string) {
  return guard(async () => {
    const store = await storeBySlug(storeSlug);
    return ok(await getCartView(store.id));
  });
}

const newsletterSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(254).toLowerCase(),
  name: z.string().trim().max(80).optional(),
});

export async function subscribeAction(storeSlug: string, formData: FormData, sessionId?: string) {
  return guard(async () => {
    const headerList = await headers();
    const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = rateLimit(`subscribe:${ip}`, { limit: 10, windowMs: 60 * 60_000 });
    if (!limit.ok) return fail("Too many signups from this connection. Try again later.");

    const parsed = newsletterSchema.safeParse({
      email: formData.get("email"),
      name: formData.get("name") ?? undefined,
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const store = await storeBySlug(storeSlug);

    const existing = await prisma.emailSubscriber.findFirst({
      where: { storeId: store.id, email: parsed.data.email },
    });
    if (existing) {
      if (existing.status === "unsubscribed") {
        await prisma.emailSubscriber.update({ where: { id: existing.id }, data: { status: "subscribed" } });
      }
      return ok(null, "You're on the list.");
    }

    await prisma.emailSubscriber.create({
      data: {
        storeId: store.id,
        email: parsed.data.email,
        name: parsed.data.name ?? null,
        source: "storefront",
      },
    });

    if (sessionId) {
      await trackEvent({
        storeId: store.id,
        type: "email_signup",
        sessionId,
        device: classifyDevice(headerList.get("user-agent")),
      }).catch(() => undefined);
      await recordConversions(store.id, sessionId, "email_signup").catch(() => undefined);
    }

    return ok(null, "Thanks — you're subscribed.");
  });
}

export async function checkoutAction(storeSlug: string, payload: unknown, sessionId?: string) {
  return guard(async () => {
    const store = await storeBySlug(storeSlug);
    assertAcceptingOrders(store);
    const headerList = await headers();
    const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

    const limit = rateLimit(`checkout:${ip}`, { limit: 20, windowMs: 10 * 60_000 });
    if (!limit.ok) return fail("Too many checkout attempts. Please wait a moment.");

    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const cart = await getCartView(store.id);
    if (!cart.items.length) return fail("Your cart is empty.");

    const unavailable = cart.items.filter((item) => !item.inStock);
    if (unavailable.length) {
      return fail(`${unavailable[0].title} no longer has enough stock. Adjust the quantity and try again.`);
    }

    // Stripe is the only real payment path; without it we record a simulated
    // order and say so plainly rather than pretending a charge happened.
    const checkoutMode = store.settings?.checkoutMode ?? "simulated";
    if (checkoutMode === "stripe") {
      return fail(
        "Stripe checkout is selected but not yet implemented in this build. Switch checkout back to simulated mode in Settings → Payments to place test orders.",
      );
    }

    const [firstName, ...rest] = input.shippingAddress.name.trim().split(/\s+/);
    const customer = await resolveCustomerForCheckout(
      store.id,
      input.email,
      { firstName: firstName ?? "", lastName: rest.join(" ") },
      input.acceptsMarketing,
    );

    const referrer = headerList.get("referer");
    const ctx = systemContext(store);

    const order = await createOrder(ctx, {
      email: input.email,
      customerId: customer.id,
      lines: cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
      shippingAddress: input.shippingAddress as unknown as Record<string, unknown>,
      billingAddress: (input.billingSameAsShipping
        ? input.shippingAddress
        : input.billingAddress ?? input.shippingAddress) as unknown as Record<string, unknown>,
      discountCode: cart.discount?.code ?? null,
      discountAmount: cart.discountTotal,
      shippingTotal: cart.shipping,
      taxTotal: cart.tax,
      source: classifySource(referrer),
      note: input.note ?? null,
      paymentProvider: "simulated",
      markPaid: true,
    });

    if (input.acceptsMarketing) {
      await prisma.emailSubscriber
        .create({
          data: { storeId: store.id, email: input.email, name: input.shippingAddress.name, source: "checkout" },
        })
        .catch(() => undefined);
    }

    if (cart.id) await emptyCart(cart.id);

    if (sessionId) {
      await trackEvent({
        storeId: store.id,
        type: "purchase",
        sessionId,
        orderId: order.id,
        customerId: customer.id,
        referrer,
        device: classifyDevice(headerList.get("user-agent")),
        value: Number(order.total),
      }).catch(() => undefined);
      await recordConversions(store.id, sessionId, "purchase", {
        orderId: order.id,
        value: Number(order.total),
      }).catch(() => undefined);
      await recordConversions(store.id, sessionId, "checkout_started", { orderId: order.id }).catch(() => undefined);
    }

    revalidatePath(`/s/${storeSlug}`, "layout");
    return ok({ orderId: order.id, orderNumber: order.number });
  });
}

export async function beginCheckoutAction(storeSlug: string, sessionId?: string) {
  return guard(async () => {
    const store = await storeBySlug(storeSlug);
    if (sessionId) {
      const headerList = await headers();
      const cart = await getCartView(store.id);
      await trackEvent({
        storeId: store.id,
        type: "checkout_started",
        sessionId,
        device: classifyDevice(headerList.get("user-agent")),
        value: cart.total,
      }).catch(() => undefined);
      await recordConversions(store.id, sessionId, "checkout_started").catch(() => undefined);
    }
    return ok(null);
  });
}

export async function clearCartAction(storeSlug: string) {
  return guard(async () => {
    const store = await storeBySlug(storeSlug);
    const cart = await getCart(store.id);
    if (cart) await emptyCart(cart.id);
    revalidatePath(`/s/${storeSlug}`, "layout");
    return ok(null);
  });
}
