"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { serviceContext } from "@/lib/services/context";
import { guard, ok } from "@/lib/action-result";
import { applyTheme } from "@/lib/services/themes";

export async function applyThemeAction(themeId: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    const result = await applyTheme(ctx, themeId);
    const store = await prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { slug: true } });
    revalidatePath("/admin/store/themes");
    revalidatePath("/admin/store/editor");
    revalidatePath("/admin/settings/design");
    revalidatePath(`/s/${store.slug}`, "layout");
    return ok(result, `Applied "${result.theme.name}". Your previous design is saved as a snapshot.`);
  });
}
