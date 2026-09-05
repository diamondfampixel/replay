import { NextResponse } from "next/server";
import { rejectCrossOrigin } from "@/lib/request-origin";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { apiContext, ValidationError } from "@/lib/services/context";
import { assertAIWithinBudget, recordAIRequest } from "@/lib/services/billing";
import { supportsEffort } from "@/lib/ai/routing";
import { getAIConfig } from "@/lib/ai/config";
import { createAnthropic, extractJson } from "@/lib/ai/client";
import { buildStoreContext } from "@/lib/ai/context";
import { can } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  testType: z.string().max(40),
  field: z.string().max(40),
  control: z.string().min(1).max(2000),
  targetType: z.enum(["page", "product"]),
  pageId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  count: z.number().int().min(1).max(5).default(2),
});

/** Generates alternative copy for an A/B test. Writes nothing. */
export async function POST(request: Request) {
  const startedAt = Date.now();
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const ctx = await apiContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(ctx.role, "experiments:write")) {
    return NextResponse.json({ error: "Your role cannot create experiments." }, { status: 403 });
  }

  try {
    await assertAIWithinBudget(ctx.organizationId);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, code: "AI_BUDGET" }, { status: 429 });
    }
    throw error;
  }

  const limit = await rateLimit(`variants:${ctx.userId}`, { limit: 20, windowMs: 5 * 60_000 });
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const config = await getAIConfig(ctx.storeId);
  if (!config) {
    return NextResponse.json(
      { error: "No Anthropic API key is configured. Add one under Integrations." },
      { status: 503 },
    );
  }

  const input = parsed.data;
  const product = input.productId
    ? await prisma.product.findFirst({
        where: { id: input.productId, storeId: ctx.storeId },
        select: { title: true, description: true, price: true, tags: true },
      })
    : null;

  const storeContext = await buildStoreContext(ctx.storeId);

  const prompt = [
    `Write ${input.count} alternative${input.count === 1 ? "" : "s"} to test against this control.`,
    "",
    `What is being tested: ${input.testType.replace(/_/g, " ")} (the "${input.field}" field)`,
    `Control (currently live): ${input.control}`,
    product ? `Product: ${product.title} — ${product.description ?? "no description"}` : null,
    "",
    "Rules:",
    "- Each alternative must be a genuinely different angle, not a reworded control.",
    "- Match the length and register of the control.",
    "- No exclamation marks, no hype, no invented claims about the product.",
    "- Do not invent facts (materials, guarantees, awards) that are not in the context above.",
    "",
    `Return only a JSON array of exactly ${input.count} strings.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const anthropic = createAnthropic(config);
    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: 1500,
      // Short structured copy: low effort keeps the quality and drops the
      // thinking tokens a harder setting would spend on a simple task.
      ...(supportsEffort(config.model) ? { output_config: { effort: "low" as const } } : {}),
      system: `You write ecommerce copy for A/B tests.\n\n## The store\n\n${storeContext}`,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const variants = z.array(z.string().min(1).max(2000)).parse(extractJson(text));

    await recordAIRequest(ctx.organizationId, {
      storeId: ctx.storeId,
      userId: ctx.userId,
      kind: "variants",
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

    return NextResponse.json({ variants: variants.slice(0, input.count) });
  } catch (error) {
    // Upstream errors can quote the request or the key's account; log them
    // server-side and hand the client a fixed string.
    console.error("[api/ai/generate-variants]", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
