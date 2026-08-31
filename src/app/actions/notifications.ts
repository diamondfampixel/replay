"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireContext } from "@/lib/session";
import { guard, ok } from "@/lib/action-result";

export async function markNotificationsReadAction(ids?: string[]) {
  return guard(async () => {
    const ctx = await requireContext();
    await prisma.notification.updateMany({
      where: {
        storeId: ctx.storeId,
        readAt: null,
        ...(ids?.length ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });
    revalidatePath("/admin", "layout");
    return ok(null);
  });
}
