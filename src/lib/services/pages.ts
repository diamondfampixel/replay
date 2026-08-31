import "server-only";
import { Prisma, prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  audit, authorize, NotFoundError, uniqueStoreSlug, ValidationError, type ServiceContext,
} from "@/lib/services/context";
import {
  isSectionType, normaliseSectionConfig, type SectionType,
} from "@/lib/storefront/sections";

export type DraftSection = {
  /** Stable across edits; matches the live PageSection id once published. */
  id: string;
  type: SectionType;
  visible: boolean;
  config: Record<string, unknown>;
};

/** The working copy: the saved draft if one exists, otherwise what is live. */
export async function getEditablePage(ctx: ServiceContext, pageId: string) {
  authorize(ctx, "storefront:read");
  const page = await prisma.page.findFirst({
    where: { id: pageId, storeId: ctx.storeId },
    include: { sections: { orderBy: { position: "asc" } } },
  });
  if (!page) throw new NotFoundError("Page");

  const live: DraftSection[] = page.sections.map((section) => ({
    id: section.id,
    type: section.type as SectionType,
    visible: section.visible,
    config: (section.config ?? {}) as Record<string, unknown>,
  }));

  const draft = normaliseDraft(page.draftSections);
  const hasUnpublishedChanges = draft !== null && JSON.stringify(draft) !== JSON.stringify(live);

  return {
    page,
    live,
    sections: draft ?? live,
    hasUnpublishedChanges,
  };
}

function normaliseDraft(value: unknown): DraftSection[] | null {
  if (!Array.isArray(value)) return null;
  const sections = value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .filter((entry) => typeof entry.type === "string" && isSectionType(entry.type as string))
    .map((entry, index) => ({
      id: typeof entry.id === "string" ? entry.id : `draft-${index}`,
      type: entry.type as SectionType,
      visible: entry.visible !== false,
      config: normaliseSectionConfig(entry.type as string, entry.config),
    }));
  return sections.length ? sections : null;
}

/** Saves the working copy without touching what visitors see. */
export async function saveDraftSections(ctx: ServiceContext, pageId: string, sections: unknown) {
  authorize(ctx, "storefront:write");
  const page = await prisma.page.findFirst({ where: { id: pageId, storeId: ctx.storeId } });
  if (!page) throw new NotFoundError("Page");

  const draft = normaliseDraft(sections);
  if (!draft) throw new ValidationError("A page needs at least one valid section.");

  await prisma.page.update({
    where: { id: pageId },
    data: { draftSections: draft as unknown as Prisma.InputJsonValue },
  });
  await audit(ctx, "page.draft.save", { type: "Page", id: pageId }, { sections: draft.length });
  return draft;
}

/** Writes the working copy onto the live section rows. */
export async function publishPage(ctx: ServiceContext, pageId: string) {
  authorize(ctx, "storefront:write");
  const page = await prisma.page.findFirst({
    where: { id: pageId, storeId: ctx.storeId },
    include: { sections: true },
  });
  if (!page) throw new NotFoundError("Page");

  const draft = normaliseDraft(page.draftSections);
  if (!draft) {
    // Nothing staged — just mark the page published.
    await prisma.page.update({
      where: { id: pageId },
      data: { published: true, publishedAt: new Date() },
    });
    return { sections: page.sections.length, published: true };
  }

  await prisma.$transaction(async (tx) => {
    const keptIds = draft.map((section) => section.id).filter((id) => !id.startsWith("draft-"));
    await tx.pageSection.deleteMany({
      where: { pageId, ...(keptIds.length ? { id: { notIn: keptIds } } : {}) },
    });

    for (const [index, section] of draft.entries()) {
      const payload = {
        type: section.type,
        position: index,
        visible: section.visible,
        config: section.config as Prisma.InputJsonValue,
      };
      const existing = page.sections.find((row) => row.id === section.id);
      if (existing) await tx.pageSection.update({ where: { id: existing.id }, data: payload });
      else await tx.pageSection.create({ data: { pageId, ...payload } });
    }

    await tx.page.update({
      where: { id: pageId },
      data: { draftSections: Prisma.DbNull, published: true, publishedAt: new Date() },
    });
  });

  await audit(ctx, "page.publish", { type: "Page", id: pageId }, { sections: draft.length });
  return { sections: draft.length, published: true };
}

export async function discardDraft(ctx: ServiceContext, pageId: string) {
  authorize(ctx, "storefront:write");
  await prisma.page.updateMany({
    where: { id: pageId, storeId: ctx.storeId },
    data: { draftSections: Prisma.DbNull },
  });
  await audit(ctx, "page.draft.discard", { type: "Page", id: pageId });
}

// ---------------------------------------------------------------------------
// Content pages
// ---------------------------------------------------------------------------

export type ContentPageInput = {
  title: string;
  slug?: string;
  body?: string | null;
  published?: boolean;
  showInNav?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export async function listPages(ctx: ServiceContext) {
  authorize(ctx, "content:read");
  return prisma.page.findMany({
    where: { storeId: ctx.storeId },
    orderBy: [{ type: "asc" }, { title: "asc" }],
    select: {
      id: true, title: true, slug: true, type: true, published: true,
      showInNav: true, updatedAt: true, draftSections: true,
      _count: { select: { sections: true } },
    },
  });
}

export async function createContentPage(ctx: ServiceContext, input: ContentPageInput) {
  authorize(ctx, "content:write");
  if (!input.title.trim()) throw new ValidationError("A page needs a title.");

  const slug = await uniqueStoreSlug("page", ctx.storeId, input.slug || slugify(input.title));
  const page = await prisma.page.create({
    data: {
      storeId: ctx.storeId,
      type: "STANDARD",
      title: input.title,
      slug,
      body: sanitizeHtml(input.body ?? ""),
      published: input.published ?? false,
      publishedAt: input.published ? new Date() : null,
      showInNav: input.showInNav ?? false,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
    },
  });
  await audit(ctx, "page.create", { type: "Page", id: page.id }, { title: page.title });
  return page;
}

export async function updateContentPage(ctx: ServiceContext, pageId: string, input: ContentPageInput) {
  authorize(ctx, "content:write");
  const existing = await prisma.page.findFirst({ where: { id: pageId, storeId: ctx.storeId } });
  if (!existing) throw new NotFoundError("Page");

  const slug =
    input.slug !== undefined || input.title !== undefined
      ? await uniqueStoreSlug("page", ctx.storeId, input.slug || slugify(input.title ?? existing.title), pageId)
      : undefined;

  const page = await prisma.page.update({
    where: { id: pageId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(slug !== undefined && { slug }),
      ...(input.body !== undefined && { body: sanitizeHtml(input.body ?? "") }),
      ...(input.showInNav !== undefined && { showInNav: input.showInNav }),
      ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
      ...(input.seoDescription !== undefined && { seoDescription: input.seoDescription }),
      ...(input.published !== undefined && {
        published: input.published,
        ...(input.published ? { publishedAt: new Date() } : {}),
      }),
    },
  });
  await audit(ctx, "page.update", { type: "Page", id: pageId });
  return page;
}

export async function deleteContentPage(ctx: ServiceContext, pageId: string) {
  authorize(ctx, "content:write");
  const page = await prisma.page.findFirst({ where: { id: pageId, storeId: ctx.storeId } });
  if (!page) throw new NotFoundError("Page");
  if (page.type === "HOME") throw new ValidationError("The homepage cannot be deleted.");

  await prisma.page.delete({ where: { id: pageId } });
  await audit(ctx, "page.delete", { type: "Page", id: pageId });
  return true;
}
