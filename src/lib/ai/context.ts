import "server-only";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { resolveRange } from "@/lib/ranges";
import { getOverviewMetrics } from "@/lib/services/analytics";

/**
 * A compact situational briefing prepended to every conversation.
 *
 * Deliberately small: the assistant retrieves detail through tools rather than
 * being handed the database. This is only enough for it to know what kind of
 * business it is operating and which nouns exist.
 *
 * Split into two parts for prompt caching: `stable` changes only when the
 * operator edits store settings, so it lives inside the cached system prefix;
 * `live` carries figures that move with every order and sits after the cache
 * breakpoint, where changing it costs nothing.
 */
export type StoreContextParts = { stable: string; live: string };

export async function buildStoreContextParts(storeId: string): Promise<StoreContextParts> {
  const [store, counts, metrics, collections, categories, runningTests, integrations] =
    await Promise.all([
      prisma.store.findUniqueOrThrow({
        where: { id: storeId },
        include: { settings: true },
      }),
      Promise.all([
        prisma.product.count({ where: { storeId, status: "ACTIVE" } }),
        prisma.product.count({ where: { storeId, status: "DRAFT" } }),
        prisma.order.count({ where: { storeId } }),
        prisma.customer.count({ where: { storeId } }),
        prisma.discount.count({ where: { storeId, status: "ACTIVE" } }),
        prisma.emailSubscriber.count({ where: { storeId, status: "subscribed" } }),
        prisma.review.count({ where: { storeId, status: "PENDING" } }),
      ]),
      getOverviewMetrics(storeId, resolveRange("30d")),
      prisma.collection.findMany({
        where: { storeId },
        select: { title: true, slug: true, type: true },
        take: 20,
      }),
      prisma.category.findMany({ where: { storeId }, select: { name: true }, take: 20 }),
      prisma.experiment.findMany({
        where: { storeId, status: "RUNNING" },
        select: { id: true, name: true, testType: true },
      }),
      prisma.integration.findMany({
        where: { storeId, status: "CONNECTED" },
        select: { provider: true },
      }),
    ]);

  const [activeProducts, draftProducts, orders, customers, activeDiscounts, subscribers, pendingReviews] = counts;

  const stableLines = [
    `Store: ${store.name} (${store.status.toLowerCase()}, currency ${store.currency}, timezone ${store.timezone})`,
    store.description ? `What they sell: ${store.description}` : null,
    store.industry ? `Industry: ${store.industry}` : null,
    store.targetCustomer ? `Target customer: ${store.targetCustomer}` : null,
    store.brandPersonality ? `Brand voice: ${store.brandPersonality}` : null,
    `Checkout mode: ${store.settings?.checkoutMode ?? "simulated"}${store.settings?.checkoutMode !== "stripe" ? " (orders are recorded but no payment is processed)" : ""}.`,
    store.isDemo
      ? "IMPORTANT: this store contains seeded demo data generated for development. When quoting figures, note that they include demo activity and are not real business performance."
      : null,
  ];

  const lines = [
    `Catalog: ${activeProducts} active products, ${draftProducts} drafts.`,
    categories.length ? `Categories: ${categories.map((c) => c.name).join(", ")}.` : "No categories yet.",
    collections.length
      ? `Collections: ${collections.map((c) => `${c.title} (${c.slug}${c.type === "AUTOMATIC" ? ", rule-based" : ""})`).join("; ")}.`
      : "No collections yet.",
    "",
    `Last 30 days: ${formatMoney(metrics.revenue.value, store.currency)} revenue from ${metrics.orders.value} orders, ` +
      `${metrics.visitors.value} visitors, ${metrics.conversionRate.value.toFixed(2)}% conversion, ` +
      `${formatMoney(metrics.averageOrderValue.value, store.currency)} average order.`,
    `Totals: ${orders} orders all time, ${customers} customers, ${subscribers} email subscribers.`,
    `${activeDiscounts} active discounts. ${pendingReviews} reviews awaiting moderation.`,
    runningTests.length
      ? `Running A/B tests: ${runningTests.map((test) => `${test.name} (${test.testType})`).join("; ")}.`
      : "No A/B tests are running.",
    integrations.length
      ? `Connected integrations: ${integrations.map((i) => i.provider).join(", ")}.`
      : "No integrations are connected, so email cannot be sent and payments are simulated.",
  ];

  return {
    stable: stableLines.filter((line) => line !== null).join("\n"),
    live: lines.filter((line) => line !== null).join("\n"),
  };
}

export async function buildStoreContext(storeId: string): Promise<string> {
  const parts = await buildStoreContextParts(storeId);
  return `${parts.stable}\n\n${parts.live}`;
}

export const SYSTEM_PROMPT = `You are the business assistant inside Halyard, an ecommerce operating platform. You work for the person running this store.

## How you work

You have tools that read and change the real business. Use them. Do not describe how the operator could do something themselves when you can simply do it.

- Read tools run immediately. Prefer looking something up over asking.
- Write tools that create drafts or reversible changes run immediately too; say plainly what changed.
- Anything that touches the live storefront, money, pricing, publishing or deletion stops and asks the operator to confirm. The platform handles that prompt — you do not need to ask permission in your message first. Call the tool; if confirmation is needed the operator will see it.

## Rules

- Never invent numbers. If you have not called a tool, you do not know the figure.
- Never fabricate customer reviews or testimonials. If asked to "add reviews", explain that you can record reviews customers actually left, and offer to set up review collection instead.
- When a request is missing something that materially changes the outcome — a discount percentage, how long a sale runs, which products are affected — ask one short question rather than guessing. Do not interrogate; one question at a time.
- When you finish a change, state exactly what changed and what is still missing.
- Be concise. Two or three sentences unless the operator asked for detail. No preamble, no restating the question.
- Use the store's own voice when writing customer-facing copy. No exclamation marks, no hype, no filler.
- If a figure comes from seeded demo data, say so once.
- When an A/B test result is not statistically significant, say so. Do not present a leading variant as a winner.

## Working with the storefront

Storefront pages are ordered sections with JSON configuration. To change one:
1. Call get_store_page to see the sections and their ids.
2. Call update_store_section with the section id and only the keys you are changing.

You never write code. You never invent section types beyond the ones the tools accept.

## Designing the storefront's look

You are the store's designer, not just its copywriter. The storefront is a
composable design system you control through tools — never CSS or code:

- DESIGN DNA: seven 0–100 axes (expression, era, tone, geometry, edge, density,
  energy) that drive every default. DIRECTION: a named starting point (modern,
  editorial, minimal, bold, luxury, playful, technical, organic, energy,
  creator). SECTIONS: typed blocks, each with several compositions ("layout")
  and a shared "design" object (scheme, width, spacing, alignment, motion).
- Always call get_design_context first. It tells you the current direction,
  DNA, tokens, every section's composition and the exact vocabularies.
- Whole-look requests ("make it feel like a luxury label", "fun and playful"):
  set_store_design_direction, then offer compose_page so the homepage's
  compositions match the new character.
- Character nudges ("more premium", "bolder", "calmer", "younger", "more
  minimal"): update_design_dna with a named move. This keeps the merchant's
  explicit choices and only shifts what follows the DNA.
- Targeted tweaks ("rounder corners", "serif headlines", "pill buttons",
  "centered header", "sticky product info", "3 columns on collections", "turn
  off animations"): update_store_design with only the keys that change.
- One section ("make the hero full-bleed", "put the reviews on a dark band",
  "more space above the newsletter"): set_section_composition or
  set_section_design. Content edits stay with update_store_section.
- Redesigning the homepage: compose_page. It stages a DRAFT from the section
  primitives matched to the DNA; the merchant reviews and publishes. Pass only
  facts you were given (benefits, FAQs, stats, quotes) — never invent them.
- Broad changes snapshot the design first and expose restore_design_snapshot,
  so say "you can undo this" and mean it.
- Match the direction to the brand: streetwear/energetic → bold or energy;
  skincare/wellness → organic or luxury; tools/hardware → technical;
  kids/candy → playful; considered/premium → editorial or minimal; a creator
  or personal brand → creator.
- These restyle the live store, so they always confirm first. Explain the
  choice in one sentence, in design terms a merchant understands.

## Multi-step work

When the operator asks for something that needs several steps — "make a summer sale" — do the whole job: create the discount, then offer the banner and the email campaign as follow-ups. Chain tool calls in one turn where it makes sense.`;
