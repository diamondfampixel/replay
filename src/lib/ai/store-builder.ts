import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getAIConfig } from "@/lib/ai/config";
import { supportsEffort } from "@/lib/ai/routing";
import { getAIBudget, recordAIRequest } from "@/lib/services/billing";
import { prisma } from "@/lib/db";
import { createAnthropic, extractJson } from "@/lib/ai/client";
import { SECTION_META, SECTION_TYPES, normaliseSectionConfig } from "@/lib/storefront/sections";
import { describeSectionFields } from "@/lib/storefront/section-fields";
import { composeHomepage, type ThemeLike } from "@/lib/storefront/compose";
import { DIRECTION_PRESETS, resolveTheme } from "@/lib/storefront/theme";
import type { OnboardingInput } from "@/lib/validation/onboarding";

const generatedSectionSchema = z.object({
  type: z.string(),
  config: z.record(z.string(), z.unknown()).default({}),
});

const generatedStoreSchema = z.object({
  tagline: z.string().max(160).optional(),
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(200).optional(),
  sections: z.array(generatedSectionSchema).min(1).max(12),
});

export type GeneratedStore = z.infer<typeof generatedStoreSchema> & { source: "ai" | "template" };

const SYSTEM_PROMPT = `You configure ecommerce storefront homepages for a platform called Halyard.

You never write code. You return JSON describing an ordered list of page sections
that the platform's renderer already knows how to draw.

Available section types, their compositions ("layout") and configuration keys:
${SECTION_TYPES.map((t) => `- ${t}${SECTION_META[t].layouts ? ` (layout: ${SECTION_META[t].layouts!.map((l) => l.id).join("|")})` : ""}: { ${describeSectionFields(t)} }`).join("\n")}
Every section also accepts "design": { scheme: "base"|"muted"|"accent"|"contrast", width: "narrow"|"contained"|"wide"|"full", paddingTop/paddingBottom: "none"|"sm"|"md"|"lg"|"xl", align: "left"|"center"|"right" }.

Rules:
- Write specific, concrete copy for this business. No filler like "Lorem ipsum",
  no generic startup language, no exclamation marks.
- Never invent customer testimonials, reviews, statistics or press logos. If you
  use a testimonials section, set items to an empty array so the operator adds
  real quotes themselves. Only claim benefits (free shipping, returns) that the
  brief states.
- Choose compositions that fit the brand's design direction and DNA given in
  the brief: expressive brands get fullBleed/asymmetric heroes and asymmetric
  product grids; restrained brands get editorial/minimal heroes and editorial
  grids; playful brands get carousels and cards.
- Keep headlines under 60 characters and subheadlines under 140.
- Order sections so the page opens strongly and ends with a newsletter or FAQ.
- Return ONLY JSON: { "tagline", "seoTitle", "seoDescription", "sections": [{ "type", "config" }] }`;

function templateStore(input: OnboardingInput, theme: ThemeLike, context?: BuilderContext): GeneratedStore {
  const sections = composeHomepage(theme, {
    name: input.businessName,
    description: input.description,
    industry: input.industry,
    goal: "catalog",
    catalog: {
      productCount: context?.productTitles?.length ?? 0,
      collectionSlugs: context?.collectionSlugs ?? [],
      hasReviews: false,
    },
    wanted: input.sections.length ? input.sections : ["hero", "featuredProducts", "imageText", "newsletter"],
  });

  return {
    tagline: input.description.slice(0, 120),
    seoTitle: input.businessName,
    seoDescription: input.description.slice(0, 155),
    sections,
    source: "template",
  };
}

export type BuilderContext = { productTitles?: string[]; collectionSlugs?: string[]; theme?: ThemeLike };

/**
 * Produces a homepage configuration for a new store. When an Anthropic key is
 * available the copy is generated; otherwise a deterministic template is used
 * so onboarding always completes with a real, editable storefront.
 */
export async function generateStoreConfig(
  storeId: string,
  input: OnboardingInput,
  context?: BuilderContext,
): Promise<GeneratedStore> {
  const theme: ThemeLike = context?.theme ?? resolveTheme({ theme: { direction: input.direction }, primaryColor: input.primaryColor });
  const config = await getAIConfig(storeId);
  if (!config || !input.generateWithAI) return templateStore(input, theme, context);

  // Onboarding generation is a real AI request: it counts as one action and
  // respects the allowance like any other. Onboarding must always complete,
  // so an exhausted allowance means the deterministic template, not an error.
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { organizationId: true } });
  if (!store) return templateStore(input, theme, context);
  try {
    const budget = await getAIBudget(store.organizationId);
    if (budget.exhausted || budget.spendCeilingReached || budget.platformPaused) {
      return templateStore(input, theme, context);
    }
  } catch {
    return templateStore(input, theme, context);
  }
  const startedAt = Date.now();

  const wantedSections = input.sections.length
    ? input.sections.join(", ")
    : "hero, featuredProducts, benefits, newsletter";

  const userPrompt = [
    `Business name: ${input.businessName}`,
    `Industry: ${input.industry}`,
    `What they sell: ${input.sells || input.description}`,
    `Description: ${input.description}`,
    input.targetCustomer ? `Target customer: ${input.targetCustomer}` : null,
    input.brandPersonality ? `Brand personality: ${input.brandPersonality}` : null,
    `Design direction: ${DIRECTION_PRESETS[theme.direction].label} — ${DIRECTION_PRESETS[theme.direction].blurb}`,
    `Design DNA (0–100): expression ${theme.dna.expression}, era ${theme.dna.era}, tone ${theme.dna.tone}, geometry ${theme.dna.geometry}, edge ${theme.dna.edge}, density ${theme.dna.density}, energy ${theme.dna.energy}`,
    `Brand colours: primary ${input.primaryColor}, secondary ${input.secondaryColor}`,
    `Requested homepage sections (in roughly this order): ${wantedSections}`,
    context?.productTitles?.length
      ? `Existing products you may reference: ${context.productTitles.slice(0, 15).join(", ")}`
      : "The catalog is empty — do not name specific products.",
    context?.collectionSlugs?.length
      ? `Existing collection slugs: ${context.collectionSlugs.join(", ")}`
      : "There are no collections yet — leave collectionSlugs empty and prefer source \"newest\".",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const anthropic = createAnthropic(config);
    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: 3000,
      ...(supportsEffort(config.model) ? { output_config: { effort: "medium" as const } } : {}),
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    await recordAIRequest(store.organizationId, {
      storeId,
      kind: "onboarding",
      tier: "standard",
      model: config.model,
      modelCalls: 1,
      toolCalls: 0,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
      status: "ok",
      durationMs: Date.now() - startedAt,
      actions: 1,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const parsed = generatedStoreSchema.parse(extractJson(text));
    const sections = parsed.sections.filter((section) =>
      SECTION_TYPES.includes(section.type as (typeof SECTION_TYPES)[number]),
    );
    if (!sections.length) return templateStore(input, theme, context);

    return { ...parsed, sections, source: "ai" };
  } catch (error) {
    console.error("[store-builder] generation failed, using template", error);
    return templateStore(input, theme, context);
  }
}

/** Writes a generated configuration onto a store's homepage. */
export async function applyGeneratedStore(
  db: PrismaClient,
  storeId: string,
  generated: GeneratedStore,
) {
  const page = await db.page.findFirst({ where: { storeId, type: "HOME" } });
  const data = {
    sections: {
      create: generated.sections.map((section, index) => ({
        type: section.type,
        position: index,
        visible: true,
        config: normaliseSectionConfig(section.type, section.config) as Prisma.InputJsonValue,
      })),
    },
  };

  if (page) {
    await db.pageSection.deleteMany({ where: { pageId: page.id } });
    return db.page.update({
      where: { id: page.id },
      data: {
        ...data,
        seoTitle: generated.seoTitle ?? undefined,
        seoDescription: generated.seoDescription ?? undefined,
        publishedAt: new Date(),
      },
    });
  }

  return db.page.create({
    data: {
      storeId,
      type: "HOME",
      title: "Home",
      slug: "home",
      published: true,
      publishedAt: new Date(),
      seoTitle: generated.seoTitle,
      seoDescription: generated.seoDescription,
      ...data,
    },
  });
}
