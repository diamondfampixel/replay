"use server";

import { revalidatePath } from "next/cache";
import { serviceContext } from "@/lib/services/context";
import { guard, ok } from "@/lib/action-result";
import {
  chooseWinner, createExperiment, deleteExperiment, setExperimentStatus,
  updateExperiment, type ExperimentInput,
} from "@/lib/services/experiments";
import type { ExperimentStatus } from "@/generated/prisma/client";

export async function createExperimentAction(input: ExperimentInput) {
  return guard(async () => {
    const ctx = await serviceContext();
    const experiment = await createExperiment(ctx, input);
    revalidatePath("/admin/experiments");
    return ok({ id: experiment.id }, `${experiment.name} created as a draft`);
  });
}

export async function updateExperimentAction(id: string, input: Partial<ExperimentInput>) {
  return guard(async () => {
    const ctx = await serviceContext();
    await updateExperiment(ctx, id, input);
    revalidatePath(`/admin/experiments/${id}`);
    return ok({ id }, "Experiment saved");
  });
}

export async function setExperimentStatusAction(id: string, status: ExperimentStatus) {
  return guard(async () => {
    const ctx = await serviceContext();
    await setExperimentStatus(ctx, id, status);
    revalidatePath(`/admin/experiments/${id}`);
    revalidatePath("/admin/experiments");
    const verbs: Record<string, string> = {
      RUNNING: "Experiment started",
      PAUSED: "Experiment paused",
      COMPLETED: "Experiment stopped",
      DRAFT: "Experiment returned to draft",
    };
    return ok(null, verbs[status] ?? "Updated");
  });
}

export async function chooseWinnerAction(id: string, variantId: string, apply: boolean) {
  return guard(async () => {
    const ctx = await serviceContext();
    const result = await chooseWinner(ctx, id, variantId, apply);
    revalidatePath(`/admin/experiments/${id}`);
    revalidatePath("/admin/experiments");
    return ok(
      result,
      result.applied
        ? `Variant ${result.variant.name} declared the winner and applied to your live store.`
        : `Variant ${result.variant.name} declared the winner. Apply the change manually where needed.`,
    );
  });
}

export async function deleteExperimentAction(id: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await deleteExperiment(ctx, id);
    revalidatePath("/admin/experiments");
    return ok(null, "Experiment deleted");
  });
}
