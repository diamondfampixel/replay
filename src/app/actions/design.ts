"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { serviceContext } from "@/lib/services/context";
import { guard, ok } from "@/lib/action-result";
import { createDesignSnapshot, deleteDesignSnapshot, listDesignSnapshots, restoreDesignSnapshot } from "@/lib/services/snapshots";

async function revalidateStore(storeId: string) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { slug: true } });
  revalidatePath("/admin/store/editor");
  revalidatePath("/admin/settings/design");
  revalidatePath(`/s/${store.slug}`, "layout");
}

export async function createSnapshotAction(label: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    const snapshot = await createDesignSnapshot(ctx, { label, source: "manual" });
    revalidatePath("/admin/store/editor");
    return ok({ ...snapshot, createdAt: snapshot.createdAt.toISOString() }, "Snapshot saved");
  });
}

export async function listSnapshotsAction() {
  return guard(async () => {
    const ctx = await serviceContext();
    const list = await listDesignSnapshots(ctx);
    return ok(list.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })));
  });
}

export async function restoreSnapshotAction(snapshotId: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    const result = await restoreDesignSnapshot(ctx, snapshotId);
    await revalidateStore(ctx.storeId);
    return ok(result, `Restored "${result.label}"`);
  });
}

export async function deleteSnapshotAction(snapshotId: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await deleteDesignSnapshot(ctx, snapshotId);
    revalidatePath("/admin/store/editor");
    return ok(null, "Snapshot deleted");
  });
}
