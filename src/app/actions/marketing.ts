"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { serviceContext, audit, authorize } from "@/lib/services/context";
import { guard, ok } from "@/lib/action-result";
import {
  createCampaign, deleteCampaign, sendCampaign, updateCampaign, type CampaignInput,
} from "@/lib/services/email";
import type { ReviewStatus } from "@/generated/prisma/client";

export async function createCampaignAction(input: CampaignInput) {
  return guard(async () => {
    const ctx = await serviceContext();
    const campaign = await createCampaign(ctx, input);
    revalidatePath("/admin/emails");
    return ok({ id: campaign.id }, "Campaign created");
  });
}

export async function updateCampaignAction(id: string, input: Partial<CampaignInput>) {
  return guard(async () => {
    const ctx = await serviceContext();
    await updateCampaign(ctx, id, input);
    revalidatePath("/admin/emails");
    revalidatePath(`/admin/emails/${id}`);
    return ok({ id }, "Campaign saved");
  });
}

export async function deleteCampaignAction(id: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await deleteCampaign(ctx, id);
    revalidatePath("/admin/emails");
    return ok(null, "Campaign deleted");
  });
}

export async function sendCampaignAction(id: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    const result = await sendCampaign(ctx, id);
    revalidatePath("/admin/emails");
    revalidatePath(`/admin/emails/${id}`);
    return ok(result, `Sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}`);
  });
}

// -- reviews ----------------------------------------------------------------

export async function setReviewStatusAction(ids: string[], status: ReviewStatus) {
  return guard(async () => {
    const ctx = await serviceContext();
    authorize(ctx, "content:write");
    const result = await prisma.review.updateMany({
      where: { id: { in: ids }, storeId: ctx.storeId },
      data: { status },
    });
    await audit(ctx, `review.${status.toLowerCase()}`, undefined, { count: result.count });
    revalidatePath("/admin/reviews");
    return ok({ count: result.count }, `${result.count} review${result.count === 1 ? "" : "s"} ${status.toLowerCase()}`);
  });
}

export async function deleteReviewsAction(ids: string[]) {
  return guard(async () => {
    const ctx = await serviceContext();
    authorize(ctx, "content:write");
    const result = await prisma.review.deleteMany({
      where: { id: { in: ids }, storeId: ctx.storeId },
    });
    await audit(ctx, "review.delete", undefined, { count: result.count });
    revalidatePath("/admin/reviews");
    return ok({ count: result.count }, `${result.count} review${result.count === 1 ? "" : "s"} deleted`);
  });
}

export async function createReviewAction(input: {
  productId: string;
  authorName: string;
  rating: number;
  title?: string;
  body: string;
  verified?: boolean;
  status?: ReviewStatus;
}) {
  return guard(async () => {
    const ctx = await serviceContext();
    authorize(ctx, "content:write");
    const product = await prisma.product.findFirst({
      where: { id: input.productId, storeId: ctx.storeId },
    });
    if (!product) throw new Error("That product does not exist in this store.");

    const review = await prisma.review.create({
      data: {
        storeId: ctx.storeId,
        productId: input.productId,
        authorName: input.authorName,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        verified: input.verified ?? false,
        status: input.status ?? "PENDING",
      },
    });
    await audit(ctx, "review.create", { type: "Review", id: review.id });
    revalidatePath("/admin/reviews");
    return ok({ id: review.id }, "Review added");
  });
}

// -- subscribers ------------------------------------------------------------

export async function setSubscriberStatusAction(ids: string[], status: "subscribed" | "unsubscribed") {
  return guard(async () => {
    const ctx = await serviceContext();
    authorize(ctx, "marketing:write");
    const result = await prisma.emailSubscriber.updateMany({
      where: { id: { in: ids }, storeId: ctx.storeId },
      data: { status },
    });
    revalidatePath("/admin/emails/subscribers");
    return ok({ count: result.count }, `${result.count} updated`);
  });
}

export async function addSubscriberAction(email: string, name?: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    authorize(ctx, "marketing:write");
    const normalised = email.trim().toLowerCase();
    const existing = await prisma.emailSubscriber.findFirst({
      where: { storeId: ctx.storeId, email: normalised },
    });
    if (existing) throw new Error("That email is already on your list.");

    await prisma.emailSubscriber.create({
      data: { storeId: ctx.storeId, email: normalised, name: name ?? null, source: "manual" },
    });
    revalidatePath("/admin/emails/subscribers");
    return ok(null, "Subscriber added");
  });
}
