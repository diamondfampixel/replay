"use server";

import { revalidatePath } from "next/cache";
import { serviceContext } from "@/lib/services/context";
import { guard, ok } from "@/lib/action-result";
import { createDiscount, deleteDiscount, updateDiscount } from "@/lib/services/discounts";
import {
  addOrderNote, cancelOrder, createOrder, fulfillOrder, refundOrder,
  type CreateOrderInput,
} from "@/lib/services/orders";
import { createCustomer, deleteCustomer, updateCustomer, upsertCustomerAddress } from "@/lib/services/customers";
import type { FulfillmentStatus } from "@/generated/prisma/client";

// -- discounts --------------------------------------------------------------

export async function createDiscountAction(input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    const discount = await createDiscount(ctx, input);
    revalidatePath("/admin/discounts");
    return ok({ id: discount.id }, `${discount.code ?? discount.title} created`);
  });
}

export async function updateDiscountAction(id: string, input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    await updateDiscount(ctx, id, input);
    revalidatePath("/admin/discounts");
    revalidatePath(`/admin/discounts/${id}`);
    return ok({ id }, "Discount saved");
  });
}

export async function deleteDiscountAction(id: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await deleteDiscount(ctx, id);
    revalidatePath("/admin/discounts");
    return ok(null, "Discount deleted");
  });
}

// -- orders -----------------------------------------------------------------

export async function fulfillOrderAction(
  id: string,
  options: { status?: FulfillmentStatus; trackingNumber?: string | null; carrier?: string | null } = {},
) {
  return guard(async () => {
    const ctx = await serviceContext();
    await fulfillOrder(ctx, id, options);
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/orders");
    return ok(null, "Order updated");
  });
}

export async function cancelOrderAction(id: string, reason?: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await cancelOrder(ctx, id, reason);
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/orders");
    return ok(null, "Order cancelled");
  });
}

export async function refundOrderAction(id: string, amount?: number, reason?: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await refundOrder(ctx, id, amount, reason);
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/orders");
    return ok(null, "Refund recorded");
  });
}

export async function addOrderNoteAction(id: string, note: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await addOrderNote(ctx, id, note);
    revalidatePath(`/admin/orders/${id}`);
    return ok(null, "Note saved");
  });
}

export async function createOrderAction(input: CreateOrderInput) {
  return guard(async () => {
    const ctx = await serviceContext();
    const order = await createOrder(ctx, input);
    revalidatePath("/admin/orders");
    return ok({ id: order.id, number: order.number }, `Order #${order.number} created`);
  });
}

// -- customers --------------------------------------------------------------

export async function createCustomerAction(input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    const customer = await createCustomer(ctx, input);
    revalidatePath("/admin/customers");
    return ok({ id: customer.id }, "Customer created");
  });
}

export async function updateCustomerAction(id: string, input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    await updateCustomer(ctx, id, input);
    revalidatePath(`/admin/customers/${id}`);
    revalidatePath("/admin/customers");
    return ok({ id }, "Customer saved");
  });
}

export async function upsertCustomerAddressAction(customerId: string, input: unknown, addressId?: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await upsertCustomerAddress(ctx, customerId, input, addressId);
    revalidatePath(`/admin/customers/${customerId}`);
    return ok(null, "Address saved");
  });
}

export async function deleteCustomerAction(id: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await deleteCustomer(ctx, id);
    revalidatePath("/admin/customers");
    return ok(null, "Customer deleted");
  });
}
