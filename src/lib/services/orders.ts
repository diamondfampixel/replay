import "server-only";
import { prisma, type Prisma, type FulfillmentStatus } from "@/lib/db";
import { round2, toNumber } from "@/lib/money";
import { audit, authorize, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { orderListParamsSchema } from "@/lib/validation/commerce";
import { decrementInventory } from "@/lib/services/products";

export type OrderListParams = import("zod").infer<typeof orderListParamsSchema>;

export async function listOrders(ctx: ServiceContext, rawParams: Record<string, unknown> = {}) {
  authorize(ctx, "orders:read");
  const params = orderListParamsSchema.parse(rawParams);

  const where: Prisma.OrderWhereInput = { storeId: ctx.storeId };
  if (params.q) {
    const asNumber = Number.parseInt(params.q.replace(/^#/, ""), 10);
    where.OR = [
      { email: { contains: params.q, mode: "insensitive" } },
      { customer: { firstName: { contains: params.q, mode: "insensitive" } } },
      { customer: { lastName: { contains: params.q, mode: "insensitive" } } },
      { discountCode: { contains: params.q, mode: "insensitive" } },
      ...(Number.isFinite(asNumber) ? [{ number: asNumber }] : []),
    ];
  }
  if (params.paymentStatus) where.paymentStatus = params.paymentStatus;
  if (params.fulfillmentStatus) where.fulfillmentStatus = params.fulfillmentStatus;
  if (params.customerId) where.customerId = params.customerId;

  const orderBy: Prisma.OrderOrderByWithRelationInput =
    params.sort === "oldest" ? { createdAt: "asc" }
    : params.sort === "total_desc" ? { total: "desc" }
    : params.sort === "total_asc" ? { total: "asc" }
    : { createdAt: "desc" };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
      select: {
        id: true, number: true, email: true, total: true, createdAt: true, isDemo: true,
        paymentStatus: true, fulfillmentStatus: true, discountCode: true, source: true,
        customer: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  return {
    rows: orders.map((order) => ({
      ...order,
      total: toNumber(order.total),
      itemCount: order._count.items,
    })),
    total,
    page: params.page,
    perPage: params.perPage,
    pageCount: Math.max(1, Math.ceil(total / params.perPage)),
  };
}

export async function getOrder(ctx: ServiceContext, id: string) {
  authorize(ctx, "orders:read");
  const order = await prisma.order.findFirst({
    where: { id, storeId: ctx.storeId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "asc" } },
      customer: { include: { addresses: true } },
    },
  });
  if (!order) throw new NotFoundError("Order");
  return order;
}

async function nextOrderNumber(tx: Prisma.TransactionClient, storeId: string) {
  const last = await tx.order.aggregate({ where: { storeId }, _max: { number: true } });
  return (last._max.number ?? 1000) + 1;
}

export type CreateOrderLine = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type CreateOrderInput = {
  email: string;
  customerId?: string | null;
  lines: CreateOrderLine[];
  shippingAddress?: Record<string, unknown> | null;
  billingAddress?: Record<string, unknown> | null;
  discountCode?: string | null;
  discountAmount?: number;
  shippingTotal?: number;
  taxTotal?: number;
  source?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
  note?: string | null;
  paymentProvider?: "simulated" | "stripe";
  markPaid?: boolean;
};

/**
 * The single order-creation path. Storefront checkout, the admin and the AI all
 * call this, so inventory, totals, payment records and the timeline always stay
 * consistent.
 */
export async function createOrder(ctx: ServiceContext, input: CreateOrderInput) {
  if (!input.lines.length) throw new ValidationError("An order needs at least one line item.");

  const productIds = input.lines.map((line) => line.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, storeId: ctx.storeId },
    include: { images: { orderBy: { position: "asc" }, take: 1 }, variants: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  const items = input.lines.map((line) => {
    const product = productMap.get(line.productId);
    if (!product) throw new ValidationError("One of the products is no longer available.");
    const variant = line.variantId ? product.variants.find((v) => v.id === line.variantId) : null;
    if (line.variantId && !variant) throw new ValidationError("The selected option is no longer available.");

    const unitPrice = toNumber(variant?.price ?? product.price);
    const quantity = Math.max(1, Math.floor(line.quantity));
    return {
      productId: product.id,
      variantId: variant?.id ?? null,
      title: product.title,
      variantTitle: variant?.title ?? null,
      sku: variant?.sku ?? product.sku ?? null,
      quantity,
      unitPrice,
      total: round2(unitPrice * quantity),
      imageUrl: variant?.imageUrl ?? product.images[0]?.url ?? null,
    };
  });

  const subtotal = round2(items.reduce((sum, item) => sum + item.total, 0));
  const discountTotal = round2(Math.min(input.discountAmount ?? 0, subtotal));
  const shippingTotal = round2(input.shippingTotal ?? 0);
  const taxTotal = round2(input.taxTotal ?? 0);
  const total = round2(subtotal - discountTotal + shippingTotal + taxTotal);
  const markPaid = input.markPaid ?? true;

  const order = await prisma.$transaction(async (tx) => {
    const number = await nextOrderNumber(tx, ctx.storeId);
    const created = await tx.order.create({
      data: {
        storeId: ctx.storeId,
        number,
        customerId: input.customerId ?? null,
        email: input.email,
        paymentStatus: markPaid ? "PAID" : "PENDING",
        fulfillmentStatus: "UNFULFILLED",
        subtotal, discountTotal, shippingTotal, taxTotal, total,
        discountCode: input.discountCode ?? null,
        notes: input.note ?? null,
        shippingAddress: (input.shippingAddress ?? undefined) as Prisma.InputJsonValue,
        billingAddress: (input.billingAddress ?? undefined) as Prisma.InputJsonValue,
        source: input.source ?? "direct",
        utmSource: input.utm?.source ?? null,
        utmMedium: input.utm?.medium ?? null,
        utmCampaign: input.utm?.campaign ?? null,
        items: { create: items },
        payments: {
          create: [{
            amount: total,
            status: markPaid ? "PAID" : "PENDING",
            provider: input.paymentProvider ?? "simulated",
          }],
        },
        events: {
          create: [
            { type: "created", message: `Order #${number} placed`, actor: ctx.actor },
            ...(markPaid
              ? [{
                  type: "paid",
                  message:
                    input.paymentProvider === "stripe"
                      ? `Payment of $${total.toFixed(2)} captured via Stripe`
                      : `Payment of $${total.toFixed(2)} recorded (simulated checkout)`,
                  actor: ctx.actor,
                }]
              : []),
          ],
        },
      },
      include: { items: true },
    });

    await decrementInventory(tx, items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    })));

    if (input.discountCode) {
      await tx.discount.updateMany({
        where: { storeId: ctx.storeId, code: input.discountCode },
        data: { usageCount: { increment: 1 } },
      });
    }

    // Keep the daily rollup's money columns aligned with the order table.
    const date = new Date();
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const units = items.reduce((sum, item) => sum + item.quantity, 0);
    await tx.analyticsDaily.upsert({
      where: { storeId_date: { storeId: ctx.storeId, date: day } },
      create: {
        storeId: ctx.storeId, date: day, orders: 1, unitsSold: units,
        grossSales: subtotal, discounts: discountTotal, netSales: round2(subtotal - discountTotal),
      },
      update: {
        orders: { increment: 1 },
        unitsSold: { increment: units },
        grossSales: { increment: subtotal },
        discounts: { increment: discountTotal },
        netSales: { increment: round2(subtotal - discountTotal) },
      },
    });

    return created;
  });

  await prisma.notification.create({
    data: {
      storeId: ctx.storeId,
      type: "new_order",
      title: `New order #${order.number} — $${total.toFixed(2)}`,
      body: input.email,
      href: `/admin/orders/${order.id}`,
    },
  });

  await checkLowInventory(ctx.storeId, productIds);
  await audit(ctx, "order.create", { type: "Order", id: order.id }, { number: order.number, total });
  return order;
}

async function checkLowInventory(storeId: string, productIds: string[]) {
  const settings = await prisma.storeSettings.findUnique({ where: { storeId } });
  if (!settings?.notifyLowInventory) return;

  const low = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      storeId,
      trackInventory: true,
      inventory: { lte: settings.lowInventoryThreshold },
    },
    select: { id: true, title: true, inventory: true },
  });
  if (!low.length) return;

  await prisma.notification.create({
    data: {
      storeId,
      type: "low_inventory",
      title: `Low stock: ${low.map((p) => p.title).join(", ")}`,
      body: low.map((p) => `${p.title} — ${p.inventory} left`).join(" · "),
      href: "/admin/products?stock=low",
    },
  });
}

export async function addOrderEvent(
  ctx: ServiceContext,
  orderId: string,
  type: string,
  message: string,
  metadata?: Record<string, unknown>,
) {
  return prisma.orderEvent.create({
    data: {
      orderId, type, message,
      actor: ctx.actor === "user" && ctx.userId ? `user:${ctx.userId}` : ctx.actor,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export async function fulfillOrder(
  ctx: ServiceContext,
  orderId: string,
  options: { status?: FulfillmentStatus; trackingNumber?: string | null; carrier?: string | null } = {},
) {
  authorize(ctx, "orders:write");
  const order = await prisma.order.findFirst({ where: { id: orderId, storeId: ctx.storeId } });
  if (!order) throw new NotFoundError("Order");
  if (order.fulfillmentStatus === "CANCELLED") {
    throw new ValidationError("A cancelled order cannot be fulfilled.");
  }

  const status = options.status ?? "FULFILLED";
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus: status,
      ...(options.trackingNumber !== undefined && { trackingNumber: options.trackingNumber }),
      ...(options.carrier !== undefined && { trackingCarrier: options.carrier }),
    },
  });

  await addOrderEvent(
    ctx, orderId, "fulfilled",
    status === "FULFILLED" ? "All items marked fulfilled" : `Fulfillment set to ${status.replace(/_/g, " ").toLowerCase()}`,
  );
  if (options.trackingNumber) {
    await addOrderEvent(ctx, orderId, "tracking", `Tracking ${options.trackingNumber}${options.carrier ? ` (${options.carrier})` : ""}`);
  }
  await audit(ctx, "order.fulfill", { type: "Order", id: orderId }, { status });
  return updated;
}

export async function cancelOrder(ctx: ServiceContext, orderId: string, reason?: string) {
  authorize(ctx, "orders:write");
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: ctx.storeId },
    include: { items: true },
  });
  if (!order) throw new NotFoundError("Order");
  if (order.fulfillmentStatus === "CANCELLED") throw new ValidationError("This order is already cancelled.");

  const updated = await prisma.$transaction(async (tx) => {
    // Cancelling returns stock that has not shipped.
    if (order.fulfillmentStatus === "UNFULFILLED") {
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { inventory: { increment: item.quantity } },
          }).catch(() => undefined);
        }
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { inventory: { increment: item.quantity } },
          }).catch(() => undefined);
        }
      }
    }
    return tx.order.update({
      where: { id: orderId },
      data: { fulfillmentStatus: "CANCELLED" },
    });
  });

  await addOrderEvent(ctx, orderId, "cancelled", reason ? `Order cancelled — ${reason}` : "Order cancelled");
  await audit(ctx, "order.cancel", { type: "Order", id: orderId }, { reason });
  return updated;
}

export async function refundOrder(ctx: ServiceContext, orderId: string, amount?: number, reason?: string) {
  authorize(ctx, "orders:write");
  const order = await prisma.order.findFirst({ where: { id: orderId, storeId: ctx.storeId } });
  if (!order) throw new NotFoundError("Order");

  const total = toNumber(order.total);
  const alreadyRefunded = toNumber(order.refundedTotal);
  const remaining = round2(total - alreadyRefunded);
  if (remaining <= 0) throw new ValidationError("This order has already been fully refunded.");

  const refundAmount = round2(Math.min(amount ?? remaining, remaining));
  if (refundAmount <= 0) throw new ValidationError("Enter a refund amount greater than zero.");

  const refundedTotal = round2(alreadyRefunded + refundAmount);
  const paymentStatus = refundedTotal >= total ? "REFUNDED" : "PARTIALLY_REFUNDED";

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id: orderId },
      data: { refundedTotal, paymentStatus },
    });
    await tx.payment.create({
      data: {
        orderId,
        amount: -refundAmount,
        status: paymentStatus,
        provider: order.isDemo ? "simulated" : "simulated",
      },
    });
    const day = new Date();
    const date = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    await tx.analyticsDaily.upsert({
      where: { storeId_date: { storeId: ctx.storeId, date } },
      create: { storeId: ctx.storeId, date, refunds: refundAmount, netSales: -refundAmount },
      update: { refunds: { increment: refundAmount }, netSales: { decrement: refundAmount } },
    });
    return result;
  });

  await addOrderEvent(
    ctx, orderId, "refunded",
    `Refund of $${refundAmount.toFixed(2)} issued${reason ? ` — ${reason}` : ""}`,
    { amount: refundAmount },
  );
  await audit(ctx, "order.refund", { type: "Order", id: orderId }, { amount: refundAmount, reason });
  return updated;
}

export async function addOrderNote(ctx: ServiceContext, orderId: string, note: string) {
  authorize(ctx, "orders:write");
  const order = await prisma.order.findFirst({ where: { id: orderId, storeId: ctx.storeId } });
  if (!order) throw new NotFoundError("Order");

  await prisma.order.update({ where: { id: orderId }, data: { notes: note } });
  await addOrderEvent(ctx, orderId, "note", note);
  await audit(ctx, "order.note", { type: "Order", id: orderId });
  return true;
}
