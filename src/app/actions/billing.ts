"use server";

import { revalidatePath } from "next/cache";
import { serviceContext } from "@/lib/services/context";
import { changePlan } from "@/lib/services/billing";
import { getPlan } from "@/lib/plans";
import { fail, guard, ok } from "@/lib/action-result";
import type { BillingCycle } from "@/generated/prisma/client";

export async function changePlanAction(planId: string, cycle: BillingCycle) {
  return guard(async () => {
    const ctx = await serviceContext();
    if (cycle !== "MONTHLY" && cycle !== "ANNUAL") return fail("Choose a billing cycle.");

    const updated = await changePlan(ctx, planId, cycle);
    revalidatePath("/admin/settings/billing");
    revalidatePath("/admin", "layout");
    return ok(
      { plan: updated.plan },
      `You're on ${getPlan(updated.plan).name} now`,
    );
  });
}
