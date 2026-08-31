import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getAIConfig } from "@/lib/ai/config";
import { createAnthropic, extractJson } from "@/lib/ai/client";
import { SECTION_TYPES, normaliseSectionConfig } from "@/lib/storefront/sections";
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

Available section types and their configuration keys:
- announcement: { text, link, background: "ink"|"brand"|"muted" }
- hero: { headline, subheadline, ctaLabel, ctaHref, secondaryCtaLabel, secondaryCtaHref, align: "left"|"center", background: "muted"|"brand"|"white", height: "small"|"medium"|"large" }
- imageHero: { headline, subheadline, ctaLabel, ctaHref, imageUrl, overlay: 0-80 }
- featuredProducts: { heading, subheading, source: "collection"|"manual"|"bestsellers"|"newest", collectionSlug, limit: 2-8, layout: "grid"|"carousel" }
- productGrid: { heading, limit, columns: 2|3|4 }
- collectionGrid: { heading, collectionSlugs: string[] }
- text: { heading, body, align }
- imageText: { heading, body, ctaLabel, ctaHref, imagePosition: "left"|"right", imageUrl }
- benefits: { heading, items: [{ title, body }] }
- testimonials: { heading, items: [{ quote, author, role }] }
- reviews: { heading, limit, minRating }
- faq: { heading, items: [{ q, a }] }
- newsletter: { heading, body, buttonLabel }
- customBanner: { heading, body, ctaLabel, ctaHref, background }

Rules:
- Write specific, concrete copy for this business. No filler like "Lorem ipsum",
  no generic startup language, no exclamation marks.
- Never invent customer testimonials or reviews as if they were real. If you use
  a testimonials section, set items to an empty array so the operator adds real
  quotes themselves.
- Keep headlines under 60 characters and subheadlines under 140.
- Order sections so the page opens strongly and ends with a newsletter or FAQ.
- Return ONLY JSON: { "tagline", "seoTitle", "seoDescription", "sections": [{ "type", "config" }] }`;

function templateStore(input: OnboardingInput): GeneratedStore {
  const wanted = new Set(input.sections.length ? input.sections : ["hero", "featuredProducts", "benefits", "newsletter"]);
  const sections: Array<{ type: string; config: Record<string, unknown> }> = [];

  if (wanted.has("announcement")) {
    sections.push({ type: "announcement", config: { text: "Free shipping on orders over $75", link: "/shop", background: "ink" } });
  }
  sections.push({
    type: "hero",
    config: {
      headline: input.businessName,
      subheadline: input.description.slice(0, 140),
      ctaLabel: "Shop now",
      ctaHref: "/shop",
      align: "left",
      background: "muted",
      height: "large",
    },
  });
  if (wanted.has("benefits")) {
    sections.push({
      type: "benefits",
      config: {
        items: [
          { title: "Considered range", body: "A short list of products chosen carefully." },
          { title: "Straightforward returns", body: "Thirty days, no forms to fill in." },
          { title: "Real support", body: "A person answers, usually the same day." },
        ],
      },
    });
  }
  if (wanted.has("featuredProducts")) {
    sections.push({ type: "featuredProducts", config: { heading: "Featured", source: "newest", limit: 4, layout: "grid" } });
  }
  if (wanted.has("collectionGrid")) {
    sections.push({ type: "collectionGrid", config: { heading: "Shop by collection", collectionSlugs: [] } });
  }
  if (wanted.has("imageText")) {
    sections.push({
      type: "imageText",
      config: {
        heading: `About ${input.businessName}`,
        body: input.description,
        ctaLabel: "Read more",
        ctaHref: "/pages/about",
        imagePosition: "right",
      },
    });
  }
  if (wanted.has("reviews")) {
    sections.push({ type: "reviews", config: { heading: "What customers say", limit: 3, minRating: 4 } });
  }
  if (wanted.has("faq")) {
    sections.push({
      type: "faq",
      config: {
        heading: "Common questions",
        items: [
          { q: "How long does shipping take?", a: "Add your shipping timelines here." },
          { q: "What is your return policy?", a: "Add your return policy here." },
        ],
      },
    });
  }
  if (wanted.has("newsletter")) {
    sections.push({
      type: "newsletter",
      config: { heading: "Stay in touch", body: "Occasional updates. No spam.", buttonLabel: "Subscribe" },
    });
  }

  return {
    tagline: input.description.slice(0, 120),
    seoTitle: input.businessName,
    seoDescription: input.description.slice(0, 155),
    sections,
    source: "template",
  };
}

/**
 * Produces a homepage configuration for a new store. When an Anthropic key is
 * available the copy is generated; otherwise a deterministic template is used
 * so onboarding always completes with a real, editable storefront.
 */
export async function generateStoreConfig(
  storeId: string,
  input: OnboardingInput,
  context?: { productTitles?: string[]; collectionSlugs?: string[] },
): Promise<GeneratedStore> {
  const config = await getAIConfig(storeId);
  if (!config || !input.generateWithAI) return templateStore(input);

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
    input.aesthetic ? `Preferred aesthetic: ${input.aesthetic}` : null,
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
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const parsed = generatedStoreSchema.parse(extractJson(text));
    const sections = parsed.sections.filter((section) =>
      SECTION_TYPES.includes(section.type as (typeof SECTION_TYPES)[number]),
    );
    if (!sections.length) return templateStore(input);

    return { ...parsed, sections, source: "ai" };
  } catch (error) {
    console.error("[store-builder] generation failed, using template", error);
    return templateStore(input);
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
