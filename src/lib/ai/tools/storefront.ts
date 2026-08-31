import { z } from "zod";
import { prisma, type Prisma } from "@/lib/db";
import { defineTool } from "@/lib/ai/types";
import { slugify } from "@/lib/utils";
import { audit, uniqueStoreSlug } from "@/lib/services/context";
import {
  SECTION_TYPES, defaultSectionConfig, isSectionType, normaliseSectionConfig, summariseSection,
} from "@/lib/storefront/sections";
import { sanitizeHtml } from "@/lib/sanitize";

async function findPage(storeId: string, page: string) {
  const record =
    page === "homepage" || page === "home"
      ? await prisma.page.findFirst({ where: { storeId, type: "HOME" } })
      : await prisma.page.findFirst({ where: { storeId, slug: page } });
  if (!record) throw new Error(`No page found for "${page}". Call get_store_page to see what exists.`);
  return record;
}

export const storefrontTools = [
  defineTool({
    name: "update_store_section",
    description:
      "Change the configuration of one storefront section — for example the hero headline, a call to action, or the announcement bar text. Call get_store_page first to see section ids and their current configuration. Only the keys you pass are changed.",
    schema: z.object({
      page: z.string().default("homepage").describe('"homepage" or a page slug'),
      sectionId: z.string().optional().describe("Preferred. From get_store_page."),
      sectionType: z
        .string()
        .optional()
        .describe('Alternative to sectionId, e.g. "hero" — targets the first section of that type'),
      config: z
        .record(z.string(), z.unknown())
        .describe('The keys to change, e.g. { "headline": "Free shipping.", "subheadline": "…" }'),
    }),
    risk: "high",
    capability: "storefront:write",
    async confirm(input, ctx) {
      const page = await findPage(ctx.storeId, input.page);
      const section = input.sectionId
        ? await prisma.pageSection.findFirst({ where: { id: input.sectionId, pageId: page.id } })
        : await prisma.pageSection.findFirst({
            where: { pageId: page.id, type: input.sectionType ?? "hero" },
            orderBy: { position: "asc" },
          });
      if (!section) throw new Error("Could not find that section.");

      const current = (section.config ?? {}) as Record<string, unknown>;
      const details = Object.entries(input.config).map(([key, value]) => {
        const before = current[key];
        return `${key}: ${typeof before === "string" ? `"${before}"` : JSON.stringify(before) ?? "—"} → ${typeof value === "string" ? `"${value}"` : JSON.stringify(value)}`;
      });

      return {
        title: `Update the ${section.type} section on ${page.title}?`,
        description: page.published
          ? "This page is live, so the change is visible to visitors immediately."
          : "This page is not published, so the change is not yet public.",
        details,
        confirmLabel: "Apply change",
      };
    },
    async execute(input, ctx) {
      const page = await findPage(ctx.storeId, input.page);
      const section = input.sectionId
        ? await prisma.pageSection.findFirst({ where: { id: input.sectionId, pageId: page.id } })
        : await prisma.pageSection.findFirst({
            where: { pageId: page.id, type: input.sectionType ?? "hero" },
            orderBy: { position: "asc" },
          });
      if (!section) throw new Error("Could not find that section.");

      const before = (section.config ?? {}) as Record<string, unknown>;
      const merged = normaliseSectionConfig(section.type, { ...before, ...input.config });

      await prisma.pageSection.update({
        where: { id: section.id },
        data: { config: merged as Prisma.InputJsonValue },
      });
      await audit(ctx, "page.section.update", { type: "PageSection", id: section.id }, {
        keys: Object.keys(input.config),
      });

      return {
        summary: `Updated the ${section.type} section on ${page.title}: ${Object.keys(input.config).join(", ")}.`,
        data: { sectionId: section.id, config: merged },
        links: [{ label: "Open store editor", href: "/admin/store/editor" }],
        undo: {
          tool: "update_store_section",
          params: { page: input.page, sectionId: section.id, config: before },
        },
      };
    },
  }),

  defineTool({
    name: "add_store_section",
    description:
      "Add a new section to a storefront page. Sections are configuration, not code — the renderer already knows how to draw every type.",
    schema: z.object({
      page: z.string().default("homepage"),
      type: z.enum(SECTION_TYPES),
      config: z.record(z.string(), z.unknown()).default({}),
      position: z.number().int().min(0).optional().describe("Where to insert; appended when omitted"),
    }),
    risk: "high",
    capability: "storefront:write",
    async confirm(input, ctx) {
      const page = await findPage(ctx.storeId, input.page);
      return {
        title: `Add a ${input.type} section to ${page.title}?`,
        description: page.published
          ? "This page is live, so the new section appears to visitors immediately."
          : "This page is not published, so the section is not yet public.",
        details: Object.entries(input.config).slice(0, 6).map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
        confirmLabel: "Add section",
      };
    },
    async execute(input, ctx) {
      const page = await findPage(ctx.storeId, input.page);
      const config = normaliseSectionConfig(input.type, { ...defaultSectionConfig(input.type), ...input.config });

      const max = await prisma.pageSection.aggregate({ where: { pageId: page.id }, _max: { position: true } });
      const position = input.position ?? (max._max.position ?? -1) + 1;

      // Shift anything at or after the insert point.
      await prisma.pageSection.updateMany({
        where: { pageId: page.id, position: { gte: position } },
        data: { position: { increment: 1 } },
      });

      const section = await prisma.pageSection.create({
        data: { pageId: page.id, type: input.type, position, config: config as Prisma.InputJsonValue },
      });
      await audit(ctx, "page.section.create", { type: "PageSection", id: section.id }, { sectionType: input.type });

      return {
        summary: `Added a ${input.type} section to ${page.title}.`,
        data: { sectionId: section.id, position },
        links: [{ label: "Open store editor", href: "/admin/store/editor" }],
        undo: { tool: "remove_store_section", params: { sectionId: section.id } },
      };
    },
  }),

  defineTool({
    name: "remove_store_section",
    description: "Remove a section from a storefront page.",
    schema: z.object({ sectionId: z.string() }),
    risk: "high",
    capability: "storefront:write",
    async confirm(input, ctx) {
      const section = await prisma.pageSection.findFirst({
        where: { id: input.sectionId, page: { storeId: ctx.storeId } },
        include: { page: true },
      });
      if (!section) throw new Error("That section does not exist.");
      return {
        title: `Remove the ${section.type} section from ${section.page.title}?`,
        description: "The section and its content are deleted.",
        details: [summariseSection(section.type, (section.config ?? {}) as Record<string, unknown>)],
        confirmLabel: "Remove section",
        destructive: true,
      };
    },
    async execute(input, ctx) {
      const section = await prisma.pageSection.findFirst({
        where: { id: input.sectionId, page: { storeId: ctx.storeId } },
      });
      if (!section) throw new Error("That section does not exist.");
      await prisma.pageSection.delete({ where: { id: input.sectionId } });
      await audit(ctx, "page.section.delete", { type: "PageSection", id: input.sectionId });
      return { summary: `Removed the ${section.type} section.`, data: { sectionId: input.sectionId } };
    },
  }),

  defineTool({
    name: "reorder_store_sections",
    description: "Set the order of sections on a page by listing their ids top to bottom.",
    schema: z.object({
      page: z.string().default("homepage"),
      sectionIds: z.array(z.string()).min(1).max(40),
    }),
    risk: "high",
    capability: "storefront:write",
    async confirm(input, ctx) {
      const page = await findPage(ctx.storeId, input.page);
      return {
        title: `Reorder sections on ${page.title}?`,
        description: "The page layout changes for visitors immediately.",
        confirmLabel: "Reorder",
      };
    },
    async execute(input, ctx) {
      const page = await findPage(ctx.storeId, input.page);
      const before = await prisma.pageSection.findMany({
        where: { pageId: page.id },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      for (const [index, sectionId] of input.sectionIds.entries()) {
        await prisma.pageSection.updateMany({
          where: { id: sectionId, pageId: page.id },
          data: { position: index },
        });
      }
      await audit(ctx, "page.sections.reorder", { type: "Page", id: page.id });

      return {
        summary: `Reordered ${input.sectionIds.length} sections on ${page.title}.`,
        data: { pageId: page.id },
        undo: {
          tool: "reorder_store_sections",
          params: { page: input.page, sectionIds: before.map((section) => section.id) },
        },
      };
    },
  }),

  defineTool({
    name: "toggle_store_section",
    description: "Show or hide a storefront section without deleting it or losing its configuration.",
    schema: z.object({ sectionId: z.string(), visible: z.boolean() }),
    risk: "high",
    capability: "storefront:write",
    async confirm(input, ctx) {
      const section = await prisma.pageSection.findFirst({
        where: { id: input.sectionId, page: { storeId: ctx.storeId } },
        include: { page: true },
      });
      return {
        title: `${input.visible ? "Show" : "Hide"} the ${section?.type} section?`,
        description: `This changes what visitors see on ${section?.page.title} immediately.`,
        confirmLabel: input.visible ? "Show section" : "Hide section",
      };
    },
    async execute(input, ctx) {
      const section = await prisma.pageSection.findFirst({
        where: { id: input.sectionId, page: { storeId: ctx.storeId } },
      });
      if (!section) throw new Error("That section does not exist.");
      await prisma.pageSection.update({ where: { id: input.sectionId }, data: { visible: input.visible } });
      return {
        summary: `${input.visible ? "Showed" : "Hid"} the ${section.type} section.`,
        data: { sectionId: input.sectionId, visible: input.visible },
        undo: { tool: "toggle_store_section", params: { sectionId: input.sectionId, visible: section.visible } },
      };
    },
  }),

  defineTool({
    name: "create_page",
    description:
      "Create a content page (About, Shipping, a custom page). Created unpublished unless asked otherwise.",
    schema: z.object({
      title: z.string().min(1).max(120),
      slug: z.string().max(120).optional(),
      body: z.string().max(20000).describe("Simple HTML: headings, paragraphs, lists, links"),
      seoDescription: z.string().max(320).optional(),
      published: z.boolean().default(false),
      showInNav: z.boolean().default(false),
    }),
    risk: "low",
    capability: "content:write",
    async escalate(input) {
      return input.published;
    },
    async confirm(input) {
      return {
        title: `Publish "${input.title}" to your live store?`,
        description: "The page becomes publicly reachable immediately.",
        details: [`URL: /pages/${input.slug ?? slugify(input.title)}`],
        confirmLabel: "Create and publish",
      };
    },
    async execute(input, ctx) {
      const slug = await uniqueStoreSlug("page", ctx.storeId, input.slug || slugify(input.title));
      const page = await prisma.page.create({
        data: {
          storeId: ctx.storeId,
          type: "STANDARD",
          title: input.title,
          slug,
          body: sanitizeHtml(input.body),
          published: input.published,
          publishedAt: input.published ? new Date() : null,
          showInNav: input.showInNav,
          seoDescription: input.seoDescription ?? null,
        },
      });
      await audit(ctx, "page.create", { type: "Page", id: page.id }, { title: page.title });

      return {
        summary: `Created the page "${page.title}" at /pages/${slug}${input.published ? " and published it." : " as a draft."}`,
        data: { pageId: page.id, slug },
        links: [{ label: `Edit ${page.title}`, href: `/admin/content/${page.id}` }],
        undo: { tool: "delete_page", params: { pageId: page.id } },
      };
    },
  }),

  defineTool({
    name: "update_page",
    description: "Change a content page's title, body, SEO fields or published state.",
    schema: z.object({
      pageId: z.string(),
      title: z.string().max(120).optional(),
      body: z.string().max(20000).optional(),
      seoTitle: z.string().max(160).optional(),
      seoDescription: z.string().max(320).optional(),
      published: z.boolean().optional(),
    }),
    risk: "low",
    capability: "content:write",
    async escalate(input, ctx) {
      if (input.published === true) return true;
      const page = await prisma.page.findFirst({ where: { id: input.pageId, storeId: ctx.storeId } });
      return Boolean(page?.published);
    },
    async confirm(input, ctx) {
      const page = await prisma.page.findFirst({ where: { id: input.pageId, storeId: ctx.storeId } });
      return {
        title: `Update the live page "${page?.title}"?`,
        description: "The change is visible to visitors immediately.",
        details: Object.keys(input).filter((key) => key !== "pageId").map((key) => `Changing: ${key}`),
        confirmLabel: "Apply change",
      };
    },
    async execute(input, ctx) {
      const { pageId, ...fields } = input;
      const existing = await prisma.page.findFirst({ where: { id: pageId, storeId: ctx.storeId } });
      if (!existing) throw new Error("That page does not exist in this store.");

      const data: Prisma.PageUpdateInput = {};
      if (fields.title !== undefined) data.title = fields.title;
      if (fields.body !== undefined) data.body = sanitizeHtml(fields.body);
      if (fields.seoTitle !== undefined) data.seoTitle = fields.seoTitle;
      if (fields.seoDescription !== undefined) data.seoDescription = fields.seoDescription;
      if (fields.published !== undefined) {
        data.published = fields.published;
        if (fields.published) data.publishedAt = new Date();
      }

      const page = await prisma.page.update({ where: { id: pageId }, data });
      await audit(ctx, "page.update", { type: "Page", id: pageId }, { keys: Object.keys(fields) });

      return {
        summary: `Updated "${page.title}".`,
        data: { pageId, changed: Object.keys(fields) },
        links: [{ label: `Edit ${page.title}`, href: `/admin/content/${pageId}` }],
        undo: {
          tool: "update_page",
          params: {
            pageId,
            ...(fields.title !== undefined && { title: existing.title }),
            ...(fields.body !== undefined && { body: existing.body ?? "" }),
            ...(fields.published !== undefined && { published: existing.published }),
          },
        },
      };
    },
  }),

  defineTool({
    name: "delete_page",
    description: "Delete a content page permanently. Anyone holding the link will get a 404.",
    schema: z.object({ pageId: z.string() }),
    risk: "high",
    capability: "content:write",
    async confirm(input, ctx) {
      const page = await prisma.page.findFirst({ where: { id: input.pageId, storeId: ctx.storeId } });
      return {
        title: `Delete the page "${page?.title}"?`,
        description: page?.published
          ? "This page is live. Deleting it will produce a 404 for anyone with the link."
          : "This page is not published.",
        confirmLabel: "Delete page",
        destructive: true,
      };
    },
    async execute(input, ctx) {
      const page = await prisma.page.findFirst({ where: { id: input.pageId, storeId: ctx.storeId } });
      if (!page) throw new Error("That page does not exist in this store.");
      if (page.type === "HOME") throw new Error("The homepage cannot be deleted.");

      await prisma.page.delete({ where: { id: input.pageId } });
      await audit(ctx, "page.delete", { type: "Page", id: input.pageId });
      return { summary: `Deleted the page "${page.title}".`, data: { pageId: input.pageId } };
    },
  }),

  defineTool({
    name: "update_store_settings",
    description: "Change store-level settings such as the name, description, contact email or brand colours.",
    schema: z.object({
      name: z.string().max(120).optional(),
      description: z.string().max(600).optional(),
      contactEmail: z.string().email().optional(),
      primaryColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
      secondaryColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
      targetCustomer: z.string().max(300).optional(),
      brandPersonality: z.string().max(200).optional(),
    }),
    risk: "high",
    capability: "settings:write",
    async confirm(input) {
      return {
        title: "Update store settings?",
        description: "These settings affect your live storefront.",
        details: Object.entries(input).map(([key, value]) => `${key}: ${value}`),
        confirmLabel: "Save settings",
      };
    },
    async execute(input, ctx) {
      const before = await prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId } });
      const provided = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
      await prisma.store.update({ where: { id: ctx.storeId }, data: provided });
      await audit(ctx, "store.update", { type: "Store", id: ctx.storeId }, { keys: Object.keys(provided) });

      return {
        summary: `Updated ${Object.keys(provided).join(", ")}.`,
        data: { changed: Object.keys(provided) },
        links: [{ label: "Settings", href: "/admin/settings" }],
        undo: {
          tool: "update_store_settings",
          params: Object.fromEntries(
            Object.keys(provided).map((key) => [key, (before as unknown as Record<string, unknown>)[key]]),
          ),
        },
      };
    },
  }),

  defineTool({
    name: "create_review",
    description:
      "Record a product review. Use only for reviews a real customer actually gave you — never invent testimonials. Reviews created this way are held for moderation.",
    schema: z.object({
      productId: z.string(),
      authorName: z.string().min(1).max(80),
      rating: z.number().int().min(1).max(5),
      title: z.string().max(120).optional(),
      body: z.string().min(1).max(2000),
      verified: z.boolean().default(false),
    }),
    risk: "low",
    capability: "content:write",
    async execute(input, ctx) {
      const product = await prisma.product.findFirst({
        where: { id: input.productId, storeId: ctx.storeId },
        select: { title: true },
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
          verified: input.verified,
          status: "PENDING",
        },
      });
      await audit(ctx, "review.create", { type: "Review", id: review.id });

      return {
        summary: `Added a ${input.rating}-star review for ${product.title}, held for moderation. Publish it from the Reviews page.`,
        data: { reviewId: review.id, status: "PENDING" },
        links: [{ label: "Reviews", href: "/admin/reviews" }],
        undo: { tool: "delete_review", params: { reviewId: review.id } },
      };
    },
  }),

  defineTool({
    name: "set_review_status",
    description: "Publish, hide or unpublish a review.",
    schema: z.object({
      reviewId: z.string(),
      status: z.enum(["PENDING", "PUBLISHED", "HIDDEN"]),
    }),
    risk: "low",
    capability: "content:write",
    async execute(input, ctx) {
      const review = await prisma.review.findFirst({
        where: { id: input.reviewId, storeId: ctx.storeId },
      });
      if (!review) throw new Error("That review does not exist in this store.");

      await prisma.review.update({ where: { id: input.reviewId }, data: { status: input.status } });
      return {
        summary: `Review set to ${input.status.toLowerCase()}.`,
        data: { reviewId: input.reviewId, status: input.status },
        undo: { tool: "set_review_status", params: { reviewId: input.reviewId, status: review.status } },
      };
    },
  }),

  defineTool({
    name: "delete_review",
    description: "Delete a review permanently. Prefer hiding it unless the caller is explicit.",
    schema: z.object({ reviewId: z.string() }),
    risk: "low",
    capability: "content:write",
    async execute(input, ctx) {
      const deleted = await prisma.review.deleteMany({
        where: { id: input.reviewId, storeId: ctx.storeId },
      });
      if (!deleted.count) throw new Error("That review does not exist in this store.");
      return { summary: "Review deleted.", data: { reviewId: input.reviewId } };
    },
  }),
];

export { isSectionType };
