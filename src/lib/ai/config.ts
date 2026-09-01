import "server-only";
import { prisma } from "@/lib/db";

/**
 * Sonnet 5 is the product default: strong at tool use, fast enough for chat,
 * and 2.5x cheaper than Opus — which is what makes the plan AI budgets
 * profitable. ANTHROPIC_MODEL overrides it per deployment.
 */
export const DEFAULT_MODEL = "claude-sonnet-5";

export type AIConfig = {
  apiKey: string;
  model: string;
  /** Where the credential came from — surfaced in the UI so it is never a mystery. */
  source: "environment" | "integration";
};

/**
 * Resolves the Anthropic credential for a store. The environment variable wins
 * so a deployment can supply one key for every tenant; otherwise the store's
 * own Anthropic integration is used.
 */
export async function getAIConfig(storeId: string): Promise<AIConfig | null> {
  // HALYARD_ANTHROPIC_KEY is the same credential under a deployment-specific
  // name, for hosts where ANTHROPIC_API_KEY would collide with other tooling
  // (the Claude Code cloud environment injects variables under chosen names).
  const envKey =
    process.env.ANTHROPIC_API_KEY?.trim() || process.env.HALYARD_ANTHROPIC_KEY?.trim();
  if (envKey) {
    return {
      apiKey: envKey,
      model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
      source: "environment",
    };
  }

  const integration = await prisma.integration.findUnique({
    where: { storeId_provider: { storeId, provider: "anthropic" } },
  });
  if (!integration || integration.status !== "CONNECTED") return null;

  const config = (integration.config ?? {}) as { apiKey?: string; model?: string };
  if (!config.apiKey) return null;

  return {
    apiKey: config.apiKey,
    model: config.model?.trim() || DEFAULT_MODEL,
    source: "integration",
  };
}

export async function isAIConfigured(storeId: string): Promise<boolean> {
  return Boolean(await getAIConfig(storeId));
}
