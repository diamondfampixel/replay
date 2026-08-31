import { z } from "zod";
import { prisma } from "@/lib/db";
import { defineTool } from "@/lib/ai/types";
import { formatMoney, toNumber } from "@/lib/money";
import { addOrderNote, cancelOrder, fulfillOrder, getOrder, refundOrder } from "@/lib/services/orders";
import { createCustomer, updateCustomer } from "@/lib/services/customers";

export const operationsTools = [
  defineTool({
    name: "fulfill_order",
    description: "Mark an order fulfilled and optionally attach a tracking number.",
    schema: z.object({
      orderId: z.string(),
      status: z.enum(["FULFILLED", "PARTIALLY_FULFILLED", "UNFULFILLED"]).default("FULFILLED"),
      trackingNumber: z.string().max(60).optional(),
      carrier: z.string().max(40).optional(),
    }),
    risk: "low",
    capability: "orders:write",
    async execute(input, ctx) {
      const before = await getOrder(ctx, input.orderId);
      await fulfillOrder(ctx, input.orderId, {
        status: input.status,
        trackingNumber: input.trackingNumber ?? null,
        carrier: input.carrier ?? null,
      });
      return {
        summary: `Order #${before.number} marked ${input.status.replace(/_/g, " ").toLowerCase()}${input.trackingNumber ? ` with tracking ${input.trackingNumber}` : ""}.`,
        data: { orderId: input.orderId, status: input.status },
        links: [{ label: `Order #${before.number}`, href: `/admin/orders/${input.orderId}` }],
        undo: { tool: "fulfill_order", params: { orderId: input.orderId, status: before.fulfillmentStatus } },
      };
    },
  }),

  defineTool({
    name: "refund_order",
    description:
      "Issue a refund against an order. Omit the amount to refund everything remaining. This is a financial action and is always confirmed.",
    schema: z.object({
      orderId: z.string(),
      amount: z.number().min(0).optional(),
      reason: z.string().max(200).optional(),
    }),
    risk: "high",
    capability: "orders:write",
    async confirm(input, ctx) {
      const order = await getOrder(ctx, input.orderId);
      const remaining = toNumber(order.total) - toNumber(order.refundedTotal);
      const amount = input.amount ?? remaining;

      return {
        title: `Refund ${formatMoney(amount, order.currency)} on order #${order.number}?`,
        description:
          "This records the refund against the order and adjusts your reported revenue. Payments in this store are simulated, so no card is credited — connect Stripe for real refunds.",
        details: [
          `Order total: ${formatMoney(toNumber(order.total), order.currency)}`,
          `Already refunded: ${formatMoney(toNumber(order.refundedTotal), order.currency)}`,
          `Refunding now: ${formatMoney(amount, order.currency)}`,
          `Customer: ${order.email}`,
        ],
        confirmLabel: "Issue refund",
        destructive: true,
      };
    },
    async execute(input, ctx) {
      const order = await getOrder(ctx, input.orderId);
      const updated = await refundOrder(ctx, input.orderId, input.amount, input.reason);
      return {
        summary: `Refunded ${formatMoney(toNumber(updated.refundedTotal) - toNumber(order.refundedTotal), order.currency)} on order #${order.number}.`,
        data: { orderId: input.orderId, refundedTotal: toNumber(updated.refundedTotal) },
        links: [{ label: `Order #${order.number}`, href: `/admin/orders/${input.orderId}` }],
      };
    },
  }),

  defineTool({
    name: "cancel_order",
    description: "Cancel an order. Unshipped stock is returned to inventory.",
    schema: z.object({ orderId: z.string(), reason: z.string().max(200).optional() }),
    risk: "high",
    capability: "orders:write",
    async confirm(input, ctx) {
      const order = await getOrder(ctx, input.orderId);
      return {
        title: `Cancel order #${order.number}?`,
        description:
          order.fulfillmentStatus === "UNFULFILLED"
            ? "Stock for every line is returned to inventory."
            : "Some items have already shipped, so stock is not returned automatically.",
        details: [
          `Customer: ${order.email}`,
          `Total: ${formatMoney(toNumber(order.total), order.currency)}`,
          `Cancelling does not refund the payment — issue a refund separately if needed.`,
        ],
        confirmLabel: "Cancel order",
        destructive: true,
      };
    },
    async execute(input, ctx) {
      const order = await getOrder(ctx, input.orderId);
      await cancelOrder(ctx, input.orderId, input.reason);
      return {
        summary: `Order #${order.number} cancelled.`,
        data: { orderId: input.orderId },
        links: [{ label: `Order #${order.number}`, href: `/admin/orders/${input.orderId}` }],
      };
    },
  }),

  defineTool({
    name: "add_order_note",
    description: "Attach an internal note to an order. Customers never see it.",
    schema: z.object({ orderId: z.string(), note: z.string().min(1).max(500) }),
    risk: "low",
    capability: "orders:write",
    async execute(input, ctx) {
      const order = await getOrder(ctx, input.orderId);
      await addOrderNote(ctx, input.orderId, input.note);
      return {
        summary: `Note added to order #${order.number}.`,
        data: { orderId: input.orderId },
        links: [{ label: `Order #${order.number}`, href: `/admin/orders/${input.orderId}` }],
      };
    },
  }),

  defineTool({
    name: "create_customer",
    description: "Add a customer record manually.",
    schema: z.object({
      email: z.string().email(),
      firstName: z.string().min(1).max(80),
      lastName: z.string().max(80).default(""),
      phone: z.string().max(40).optional(),
      tags: z.array(z.string().max(40)).max(20).default([]),
      notes: z.string().max(2000).optional(),
      acceptsMarketing: z.boolean().default(false),
    }),
    risk: "low",
    capability: "customers:write",
    async execute(input, ctx) {
      const customer = await createCustomer(ctx, input);
      return {
        summary: `Added ${customer.firstName} ${customer.lastName} (${customer.email}).`,
        data: { customerId: customer.id },
        links: [{ label: "Customer", href: `/admin/customers/${customer.id}` }],
      };
    },
  }),

  defineTool({
    name: "tag_customer",
    description: "Add or replace tags on a customer.",
    schema: z.object({
      customerId: z.string(),
      tags: z.array(z.string().max(40)).max(20),
      mode: z.enum(["add", "replace"]).default("add"),
    }),
    risk: "low",
    capability: "customers:write",
    async execute(input, ctx) {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, storeId: ctx.storeId },
      });
      if (!customer) throw new Error("That customer does not exist in this store.");

      const next =
        input.mode === "replace" ? input.tags : [...new Set([...customer.tags, ...input.tags])];
      await updateCustomer(ctx, input.customerId, { tags: next });

      return {
        summary: `${customer.firstName} ${customer.lastName} now tagged: ${next.join(", ") || "none"}.`,
        data: { customerId: input.customerId, tags: next },
        undo: { tool: "tag_customer", params: { customerId: input.customerId, tags: customer.tags, mode: "replace" } },
      };
    },
  }),
];
