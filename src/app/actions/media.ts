"use server";

import { revalidatePath } from "next/cache";
import { serviceContext } from "@/lib/services/context";
import { guard, ok } from "@/lib/action-result";
import { deleteMedia, updateMediaAlt } from "@/lib/services/media";

export async function deleteMediaAction(id: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await deleteMedia(ctx, id);
    revalidatePath("/admin/media");
    return ok(null, "File deleted");
  });
}

export async function updateMediaAltAction(id: string, alt: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await updateMediaAlt(ctx, id, alt);
    revalidatePath("/admin/media");
    return ok(null, "Alt text saved");
  });
}
