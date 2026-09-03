import { z } from "zod";
import { prisma, type Prisma } from "@/lib/db";
import { defineTool } from "@/lib/ai/types";
import { audit } from "@/lib/services/context";
import { createDesignSnapshot, listDesignSnapshots, restoreDesignSnapshot } from "@/lib/services/snapshots";
import { getEditablePage, saveDraftSections } from "@/lib/services/pages";
import { applyStoreTheme, getStoreTheme } from "@/lib/storefront/design";
import { DESIGN_DIRECTIONS, DIRECTION_PRESETS, resolveTheme, themeWarnings } from "@/lib/storefront/theme";
import { DNA_AXES, DNA_MOVES, applyDnaMove, describeDna, dnaOverrideSchema, type DesignDNA } from "@/lib/storefront/dna";
import { SECTION_META, SECTION_TYPES, designSchema, normaliseSectionConfig, summariseSection, type SectionType } from "@/lib/storefront/sections";
import { describeSectionFields } from "@/lib/storefront/section-fields";
import { composeHomepage, describeComposition, type ComposeBrief } from "@/lib/storefront/compose";

const MOVE_KEYS = Object.keys(DNA_MOVES) as [keyof typeof DNA_MOVES, ...Array<keyof typeof DNA_MOVES>];

async function findPage(storeId: string, page: string) {
  const record =
    page === "homepage" || page === "home"
      ? await prisma.page.findFirst({ where: { storeId, type: "HOME" } })
      : await prisma.page.findFirst({ where: { storeId, slug: page } });
  if (!record) throw new Error(`No page found for "${page}". Call get_design_context to see what exists.`);
  return record;
}

async function resolvedFor(storeId: string) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { theme: true, primaryColor: true, secondaryColor: true } });
  return resolveTheme({ theme: store.theme, primaryColor: store.primaryColor, secondaryColor: store.secondaryColor });
}

/**
 * The AI designer's tools. Everything operates on structured design data —
 * the theme, Design DNA, and section configs — never on CSS or React. Broad
 * changes take a snapshot first so they are reversible with one tool call.
 */
export const designTools = [
  defineTool({
    name: "get_design_context",
    description:
      "The store's whole design in one call: direction, Design DNA (seven 0–100 axes), resolved tokens, header/footer/product/collection layouts, every homepage section with its composition and design overrides, accessibility warnings, recent snapshots, and the vocabularies you can use. Call this before any design change so your changes fit what is already there.",
    schema: z.object({}),
    risk: "read",
    capability: "storefront:read",
    async execute(_input, ctx) {
      const [theme, page, snapshots] = await Promise.all([
        resolvedFor(ctx.storeId),
        prisma.page.findFirst({ where: { storeId: ctx.storeId, type: "HOME" }, include: { sections: { orderBy: { position: "asc" } } } }),
        listDesignSnapshots(ctx, 5),
      ]);
      const sections = (page?.sections ?? []).map((s) => {
        const config = normaliseSectionConfig(s.type, s.config);
        return { id: s.id, type: s.type, visible: s.visible, layout: config.layout ?? null, design: config.design, summary: summariseSection(s.type, config) };
      });
      return {
        summary: `${DIRECTION_PRESETS[theme.direction].label} direction · ${describeDna(theme.dna)} · ${sections.length} homepage sections.`,
        data: {
          direction: theme.direction,
          dna: theme.dna,
          dnaDescription: describeDna(theme.dna),
          fonts: { display: theme.fontDisplay, body: theme.fontBody, accent: theme.fontAccent },
          tokens: { background: theme.vars["--st-bg"], foreground: theme.vars["--st-fg"], accent: theme.vars["--st-accent"], radius: theme.vars["--st-radius"], isDark: theme.isDark },
          motion: theme.motionConfig,
          layout: theme.layout, buttons: theme.buttons, cards: theme.cards,
          header: theme.header, footer: { style: theme.footer.style, scheme: theme.footer.scheme, showNewsletter: theme.footer.showNewsletter },
          product: theme.product, collection: theme.collection,
          customSchemes: theme.schemes.map((s) => s.id),
          warnings: themeWarnings(theme),
          homepage: page ? { pageId: page.id, published: page.published, hasDraft: Array.isArray(page.draftSections), sections } : null,
          snapshots,
          vocabulary: {
            directions: DESIGN_DIRECTIONS,
            dnaAxes: DNA_AXES.map((a) => `${a.key}: ${a.low} (0) → ${a.high} (100)`),
            dnaMoves: MOVE_KEYS,
            sections: Object.fromEntries(SECTION_TYPES.map((t) => [t, { category: SECTION_META[t].category, layouts: SECTION_META[t].layouts?.map((l) => l.id) ?? [], fields: describeSectionFields(t) }])),
            sectionDesign: "scheme: base|muted|accent|contrast|custom, width: narrow|contained|wide|full, paddingTop/paddingBottom: none|sm|md|lg|xl, align: left|center|right, motion: inherit|off|subtle|expressive, reveal: inherit|none|fade|slide|scale|blur, border: none|top|bottom|both, mobileAlign, mobileHide",
          },
        },
      };
    },
  }),

  defineTool({
    name: "update_design_dna",
    description:
      "Bend the store's Design DNA — the seven axes (expression, era, tone, geometry, edge, density, energy) that drive every default. Use named moves for requests like 'make it feel more premium', 'bolder', 'calmer', 'younger', 'more minimal', 'more playful', 'more serious', or set axes directly. Tokens the merchant has not overridden follow the DNA. A snapshot is taken first.",
    schema: z.object({
      moves: z.array(z.object({ move: z.enum(MOVE_KEYS), strength: z.number().min(0.25).max(2).default(1) })).max(4).optional(),
      axes: dnaOverrideSchema.optional().describe("Explicit axis values 0–100; only the ones you pass change"),
    }),
    risk: "high",
    capability: "storefront:write",
    async confirm(input, ctx) {
      const theme = await resolvedFor(ctx.storeId);
      const next = preview(theme.dna, input);
      return {
        title: "Adjust the store's Design DNA?",
        description: `${describeDna(theme.dna)} → ${describeDna(next)}. Fonts, shapes, spacing and motion that follow the DNA will shift together.`,
        details: DNA_AXES.filter((a) => theme.dna[a.key] !== next[a.key]).map((a) => `${a.key}: ${theme.dna[a.key]} → ${next[a.key]}`),
        confirmLabel: "Apply",
      };
    },
    async execute(input, ctx) {
      const theme = await resolvedFor(ctx.storeId);
      const snapshot = await createDesignSnapshot(ctx, { label: "Before AI DNA change", source: "ai" });
      const next = preview(theme.dna, input);
      await applyStoreTheme(ctx.storeId, { dna: next });
      await audit(ctx, "store.design.dna", { type: "Store", id: ctx.storeId }, { moves: input.moves?.map((m) => m.move) });
      return {
        summary: `Design DNA is now: ${describeDna(next)}.`,
        data: { dna: next, snapshotId: snapshot.id },
        links: [{ label: "Design settings", href: "/admin/settings/design" }],
        undo: { tool: "restore_design_snapshot", params: { snapshotId: snapshot.id } },
      };
    },
  }),

  defineTool({
    name: "set_section_composition",
    description: "Switch one section to a different composition (its `layout`), e.g. a hero from 'left' to 'editorial' or featured products from 'grid' to 'asymmetric'. Content is kept. See get_design_context for each section's available layouts.",
    schema: z.object({
      page: z.string().default("homepage"),
      sectionId: z.string(),
      layout: z.string(),
    }),
    risk: "high",
    capability: "storefront:write",
    async confirm(input, ctx) {
      const page = await findPage(ctx.storeId, input.page);
      const section = await prisma.pageSection.findFirst({ where: { id: input.sectionId, pageId: page.id } });
      if (!section) throw new Error("Could not find that section.");
      const meta = SECTION_META[section.type as SectionType];
      const target = meta?.layouts?.find((l) => l.id === input.layout);
      if (!target) throw new Error(`"${input.layout}" is not a composition of ${section.type}. Options: ${meta?.layouts?.map((l) => l.id).join(", ") || "none"}.`);
      return { title: `Change the ${meta.label} section to "${target.label}"?`, description: page.published ? "The live page changes immediately." : "The page is not published yet.", confirmLabel: "Apply" };
    },
    async execute(input, ctx) {
      const page = await findPage(ctx.storeId, input.page);
      const section = await prisma.pageSection.findFirst({ where: { id: input.sectionId, pageId: page.id } });
      if (!section) throw new Error("Could not find that section.");
      const before = (section.config ?? {}) as Record<string, unknown>;
      const merged = normaliseSectionConfig(section.type, { ...before, layout: input.layout });
      if (merged.layout !== input.layout) throw new Error(`"${input.layout}" is not a valid composition for ${section.type}.`);
      await prisma.pageSection.update({ where: { id: section.id }, data: { config: merged as Prisma.InputJsonValue } });
      await audit(ctx, "page.section.composition", { type: "PageSection", id: section.id }, { layout: input.layout });
      return {
        summary: `${SECTION_META[section.type as SectionType].label} now uses the "${input.layout}" composition.`,
        data: { sectionId: section.id, layout: input.layout },
        links: [{ label: "Open store editor", href: "/admin/store/editor" }],
        undo: { tool: "set_section_composition", params: { page: input.page, sectionId: section.id, layout: before.layout ?? merged.layout } },
      };
    },
  }),

  defineTool({
    name: "set_section_design",
    description: "Change one section's design overrides without touching its content: colour scheme (base|muted|accent|contrast|custom), width, spacing above/below, alignment, divider borders, motion and scroll-reveal, and mobile alignment/visibility. Only the keys you pass change.",
    schema: z.object({
      page: z.string().default("homepage"),
      sectionId: z.string(),
      design: designSchema.partial(),
    }),
    risk: "high",
    capability: "storefront:write",
    async confirm(input, ctx) {
      const page = await findPage(ctx.storeId, input.page);
      const section = await prisma.pageSection.findFirst({ where: { id: input.sectionId, pageId: page.id } });
      if (!section) throw new Error("Could not find that section.");
      return {
        title: `Restyle the ${SECTION_META[section.type as SectionType]?.label ?? section.type} section?`,
        description: page.published ? "The live page changes immediately." : "The page is not published yet.",
        details: Object.entries(input.design).map(([k, v]) => `${k}: ${String(v)}`),
        confirmLabel: "Apply",
      };
    },
    async execute(input, ctx) {
      const page = await findPage(ctx.storeId, input.page);
      const section = await prisma.pageSection.findFirst({ where: { id: input.sectionId, pageId: page.id } });
      if (!section) throw new Error("Could not find that section.");
      const before = normaliseSectionConfig(section.type, section.config);
      const merged = normaliseSectionConfig(section.type, { ...before, design: { ...(before.design as Record<string, unknown>), ...input.design } });
      await prisma.pageSection.update({ where: { id: section.id }, data: { config: merged as Prisma.InputJsonValue } });
      await audit(ctx, "page.section.design", { type: "PageSection", id: section.id }, { keys: Object.keys(input.design) });
      return {
        summary: `Updated the ${section.type} section's design: ${Object.keys(input.design).join(", ")}.`,
        data: { sectionId: section.id, design: merged.design },
        links: [{ label: "Open store editor", href: "/admin/store/editor" }],
        undo: { tool: "set_section_design", params: { page: input.page, sectionId: section.id, design: before.design } },
      };
    },
  }),

  defineTool({
    name: "compose_page",
    description:
      "Compose a whole homepage from the section primitives, matched to the store's direction and Design DNA. The result is staged as a DRAFT in the store editor (nothing goes live until the merchant publishes), and a snapshot is taken first. Pass only facts you have been given: benefits, FAQs, stats and quotes are left out unless supplied — never invent them. Use this for 'redesign my homepage', 'build me a launch page', or after changing the design direction.",
    schema: z.object({
      page: z.string().default("homepage"),
      goal: z.enum(["launch", "catalog", "story", "conversion"]).default("catalog"),
      tagline: z.string().max(90).optional().describe("Hero headline. Omit to use the store name."),
      emphasis: z.string().max(80).optional(),
      sections: z.array(z.enum(SECTION_TYPES)).max(14).optional().describe("Restrict to these section types (hero is always included)"),
      facts: z.object({
        benefits: z.array(z.object({ title: z.string().max(80), body: z.string().max(240).optional(), icon: z.string().max(24).optional() })).max(6).optional(),
        faqs: z.array(z.object({ q: z.string().max(200), a: z.string().max(1200) })).max(12).optional(),
        stats: z.array(z.object({ value: z.string().max(24), label: z.string().max(80) })).max(6).optional(),
        marquee: z.array(z.string().max(80)).max(12).optional(),
        quote: z.object({ quote: z.string().max(400), author: z.string().max(80).optional(), role: z.string().max(80).optional() }).optional(),
        announcement: z.string().max(160).optional(),
      }).optional(),
    }),
    risk: "high",
    capability: "storefront:write",
    async confirm(input, ctx) {
      const { sections } = await plan(ctx.storeId, input);
      return {
        title: "Compose a new homepage draft?",
        description: "The current homepage is snapshotted, then this composition is staged as a draft for review in the store editor. Nothing goes live until you publish.",
        details: describeComposition(sections),
        confirmLabel: "Stage draft",
      };
    },
    async execute(input, ctx) {
      const page = await findPage(ctx.storeId, input.page);
      const snapshot = await createDesignSnapshot(ctx, { label: "Before AI composition", source: "ai" });
      const { sections, theme } = await plan(ctx.storeId, input);
      const existing = await getEditablePage(ctx, page.id);
      // Keep stable ids for sections of the same type at the same slot so the
      // editor's selection survives, otherwise mint draft ids.
      const draft = sections.map((s, i) => ({
        id: existing.live[i]?.type === s.type ? existing.live[i].id : `draft-compose-${i}`,
        type: s.type, visible: true, config: s.config,
      }));
      await saveDraftSections(ctx, page.id, draft);
      await audit(ctx, "page.compose", { type: "Page", id: page.id }, { goal: input.goal, sections: sections.length, direction: theme.direction });
      return {
        summary: `Staged a ${sections.length}-section homepage draft in the ${DIRECTION_PRESETS[theme.direction].label} direction: ${describeComposition(sections).join("; ")}. Review and publish it in the store editor.`,
        data: { pageId: page.id, snapshotId: snapshot.id, sections: describeComposition(sections) },
        links: [{ label: "Review draft in editor", href: "/admin/store/editor" }],
        undo: { tool: "restore_design_snapshot", params: { snapshotId: snapshot.id } },
      };
    },
  }),

  defineTool({
    name: "create_design_snapshot",
    description: "Save a named snapshot of the current design (theme + homepage sections) so it can be restored later.",
    schema: z.object({ label: z.string().min(1).max(80) }),
    risk: "low",
    capability: "storefront:write",
    async execute(input, ctx) {
      const snapshot = await createDesignSnapshot(ctx, { label: input.label, source: "manual" });
      return { summary: `Saved snapshot "${snapshot.label}".`, data: { snapshotId: snapshot.id }, links: [{ label: "Design history", href: "/admin/store/editor" }] };
    },
  }),

  defineTool({
    name: "restore_design_snapshot",
    description: "Restore a design snapshot: the theme and the live homepage sections go back to that point. The current state is captured first so this is reversible too.",
    schema: z.object({ snapshotId: z.string() }),
    risk: "high",
    capability: "storefront:write",
    async confirm(input, ctx) {
      const snapshot = await prisma.designSnapshot.findFirst({ where: { id: input.snapshotId, storeId: ctx.storeId } });
      if (!snapshot) throw new Error("That snapshot does not exist.");
      return { title: `Restore "${snapshot.label}"?`, description: "Theme and live homepage sections are replaced. The current state is saved first.", details: [`Taken ${snapshot.createdAt.toLocaleString()}`], confirmLabel: "Restore" };
    },
    async execute(input, ctx) {
      const result = await restoreDesignSnapshot(ctx, input.snapshotId);
      return { summary: `Restored "${result.label}" (${result.restoredPages} page${result.restoredPages === 1 ? "" : "s"}).`, data: result, links: [{ label: "View store", href: "/admin/store" }] };
    },
  }),
];

function preview(current: DesignDNA, input: { moves?: Array<{ move: keyof typeof DNA_MOVES; strength: number }>; axes?: Partial<DesignDNA> }): DesignDNA {
  let next: DesignDNA = { ...current };
  for (const m of input.moves ?? []) next = applyDnaMove(next, m.move, m.strength);
  for (const a of DNA_AXES) {
    const v = input.axes?.[a.key];
    if (typeof v === "number") next[a.key] = Math.max(0, Math.min(100, Math.round(v)));
  }
  return next;
}

async function plan(storeId: string, input: { goal: "launch" | "catalog" | "story" | "conversion"; tagline?: string; emphasis?: string; sections?: SectionType[]; facts?: ComposeBrief["facts"] }) {
  const [store, theme, productCount, collections, reviewCount, newest] = await Promise.all([
    prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { name: true, description: true, industry: true } }),
    resolvedFor(storeId),
    prisma.product.count({ where: { storeId, status: "ACTIVE" } }),
    prisma.collection.findMany({ where: { storeId, visible: true }, select: { slug: true }, orderBy: { position: "asc" }, take: 6 }),
    prisma.review.count({ where: { storeId, status: "PUBLISHED" } }),
    prisma.product.findFirst({ where: { storeId, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);
  const brief: ComposeBrief = {
    name: store.name, description: store.description, industry: store.industry, tagline: input.tagline, goal: input.goal, emphasis: input.emphasis,
    facts: input.facts,
    catalog: { productCount, collectionSlugs: collections.map((c) => c.slug), featuredProductId: newest?.id ?? null, hasReviews: reviewCount > 0 },
    wanted: input.sections,
  };
  return { sections: composeHomepage(theme, brief), theme, brief };
}

export { getStoreTheme };
