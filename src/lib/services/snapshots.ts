import "server-only";
import { Prisma, prisma } from "@/lib/db";
import { audit, authorize, NotFoundError, type ServiceContext } from "@/lib/services/context";
import { isSectionType, normaliseSectionConfig } from "@/lib/storefront/sections";
import { storeThemeSchema } from "@/lib/storefront/theme";
import { getPlan } from "@/lib/plans";

export type SnapshotSource = "manual" | "ai" | "auto";
export type SnapshotSummary = { id: string; label: string; source: SnapshotSource; createdAt: Date; pageCount: number };

type SnapshotPage = {
  pageId: string; slug: string; type: string; title: string;
  sections: Array<{ id: string; type: string; visible: boolean; config: Record<string, unknown> }>;
};

/**
 * Retention is a rolling count per store, set by the organization's plan
 * (Harbor 5 · Skiff 20 · Clipper 50 · Flagship 100). Snapshots are structured
 * configuration only — theme JSON + section configs, never copies of media —
 * so even the largest tier stays small.
 */
export async function snapshotLimitFor(storeId: string): Promise<number> {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { organization: { select: { plan: true } } } });
  return getPlan(store.organization.plan).limits.designSnapshots;
}

/**
 * Captures the store's whole design — theme plus every page's live sections —
 * so an AI redesign or an experiment in the editor is always one click from
 * being undone. Snapshots are strictly store-scoped.
 */
export async function createDesignSnapshot(ctx: ServiceContext, input: { label: string; source?: SnapshotSource }) {
  authorize(ctx, "storefront:write");
  const [store, pages] = await Promise.all([
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { theme: true } }),
    prisma.page.findMany({
      where: { storeId: ctx.storeId, type: "HOME" },
      include: { sections: { orderBy: { position: "asc" } } },
    }),
  ]);
  const captured: SnapshotPage[] = pages.map((page) => ({
    pageId: page.id, slug: page.slug, type: page.type, title: page.title,
    sections: page.sections.map((s) => ({ id: s.id, type: s.type, visible: s.visible, config: (s.config ?? {}) as Record<string, unknown> })),
  }));

  const snapshot = await prisma.designSnapshot.create({
    data: {
      storeId: ctx.storeId,
      label: input.label.trim().slice(0, 80) || "Snapshot",
      source: input.source ?? "manual",
      theme: (store.theme ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      pages: captured as unknown as Prisma.InputJsonValue,
      createdBy: ctx.userId ?? null,
    },
  });
  await prune(ctx.storeId);
  await audit(ctx, "design.snapshot.create", { type: "DesignSnapshot", id: snapshot.id }, { label: snapshot.label, source: snapshot.source });
  return { id: snapshot.id, label: snapshot.label, source: snapshot.source as SnapshotSource, createdAt: snapshot.createdAt, pageCount: captured.length };
}

/**
 * Keeps the newest `limit` snapshots. When the limit is reached the oldest
 * eligible snapshot goes first: automatic and AI snapshots before manual ones,
 * and within a class the oldest first — a merchant's own named snapshot is the
 * last thing to be recycled.
 */
export async function pruneSnapshots(storeId: string, limit?: number) {
  const max = limit ?? (await snapshotLimitFor(storeId));
  const all = await prisma.designSnapshot.findMany({ where: { storeId }, orderBy: { createdAt: "asc" }, select: { id: true, source: true } });
  if (all.length <= max) return 0;
  const excess = all.length - max;
  const order = (source: string) => (source === "manual" ? 1 : 0);
  const victims = [...all].sort((a, b) => order(a.source) - order(b.source)).slice(0, excess);
  await prisma.designSnapshot.deleteMany({ where: { storeId, id: { in: victims.map((v) => v.id) } } });
  return victims.length;
}
const prune = pruneSnapshots;

export async function listDesignSnapshots(ctx: ServiceContext, limit = 30): Promise<SnapshotSummary[]> {
  authorize(ctx, "storefront:read");
  const rows = await prisma.designSnapshot.findMany({
    where: { storeId: ctx.storeId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, label: true, source: true, createdAt: true, pages: true },
  });
  return rows.map((r) => ({ id: r.id, label: r.label, source: r.source as SnapshotSource, createdAt: r.createdAt, pageCount: Array.isArray(r.pages) ? r.pages.length : 0 }));
}

/**
 * Restores theme + live page sections from a snapshot. The current state is
 * captured first (source "auto") so a restore is itself reversible. Pages
 * that no longer exist are skipped; drafts on restored pages are cleared.
 */
export async function restoreDesignSnapshot(ctx: ServiceContext, snapshotId: string) {
  authorize(ctx, "storefront:write");
  const snapshot = await prisma.designSnapshot.findFirst({ where: { id: snapshotId, storeId: ctx.storeId } });
  if (!snapshot) throw new NotFoundError("Snapshot");

  await createDesignSnapshot(ctx, { label: `Before restoring "${snapshot.label}"`, source: "auto" });

  const theme = storeThemeSchema.safeParse(snapshot.theme ?? {});
  const pages = (Array.isArray(snapshot.pages) ? snapshot.pages : []) as SnapshotPage[];
  let restoredPages = 0;

  await prisma.$transaction(async (tx) => {
    await tx.store.update({
      where: { id: ctx.storeId },
      data: { theme: theme.success ? (theme.data as Prisma.InputJsonValue) : Prisma.JsonNull },
    });
    for (const page of pages) {
      const existing = await tx.page.findFirst({ where: { id: page.pageId, storeId: ctx.storeId } });
      if (!existing) continue;
      await tx.pageSection.deleteMany({ where: { pageId: existing.id } });
      const sections = (page.sections ?? []).filter((s) => isSectionType(s.type));
      for (const [index, section] of sections.entries()) {
        await tx.pageSection.create({
          data: { pageId: existing.id, type: section.type, position: index, visible: section.visible !== false, config: normaliseSectionConfig(section.type, section.config) as Prisma.InputJsonValue },
        });
      }
      await tx.page.update({ where: { id: existing.id }, data: { draftSections: Prisma.DbNull } });
      restoredPages += 1;
    }
  });

  await audit(ctx, "design.snapshot.restore", { type: "DesignSnapshot", id: snapshotId }, { restoredPages });
  return { restoredPages, label: snapshot.label };
}

export async function deleteDesignSnapshot(ctx: ServiceContext, snapshotId: string) {
  authorize(ctx, "storefront:write");
  const deleted = await prisma.designSnapshot.deleteMany({ where: { id: snapshotId, storeId: ctx.storeId } });
  if (!deleted.count) throw new NotFoundError("Snapshot");
  await audit(ctx, "design.snapshot.delete", { type: "DesignSnapshot", id: snapshotId });
}
