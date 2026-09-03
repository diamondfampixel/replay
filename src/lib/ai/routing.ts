/**
 * Model routing: which model, how much thinking effort, and how much output
 * a request is allowed, decided before the first model call from the
 * operator's message alone. No model call is spent on the decision.
 *
 * Three tiers:
 *   light    — read-only questions ("what sold best last week?"). Served by a
 *              small, fast model; tool use for reads is well within its reach
 *              and it costs roughly a fifth of the default model.
 *   standard — changes to the store (create, update, discount, refund…). The
 *              default model at medium effort.
 *   design   — storefront design work, the one place where taste and
 *              multi-step planning decide the outcome. Default model, high
 *              effort, the most output room.
 *
 * A tier only ever escalates: if the light model reaches for a write or design
 * tool mid-request, the next model call is made at the higher tier. Nothing
 * routes down. Misrouting therefore costs money, never quality or safety —
 * permissions and confirmations are enforced in the executor, whatever model
 * asked.
 *
 * Pure module: unit-tested without a database or an API key.
 */
import type { StoredToolCall } from "@/lib/ai/conversation";

export type RequestTier = "light" | "standard" | "design";

export type ModelEffort = "low" | "medium" | "high";

export type RouteDecision = {
  tier: RequestTier;
  model: string;
  /** Sent as output_config.effort on models that accept it; omitted otherwise. */
  effort: ModelEffort | null;
  maxTokens: number;
};

/** The small model that serves the light tier. AI_LIGHT_MODEL overrides; "off" disables routing down. */
export const DEFAULT_LIGHT_MODEL = "claude-haiku-4-5";

const TIER_RANK: Record<RequestTier, number> = { light: 0, standard: 1, design: 2 };

export function higherTier(a: RequestTier, b: RequestTier): RequestTier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

/** Tools whose use marks a request as design work. */
export const DESIGN_TOOLS = new Set([
  "get_design_context",
  "update_design_dna",
  "set_section_composition",
  "set_section_design",
  "compose_page",
  "create_design_snapshot",
  "restore_design_snapshot",
  "set_store_design_direction",
  "update_store_design",
  "update_store_section",
  "add_store_section",
  "remove_store_section",
  "reorder_store_sections",
  "toggle_store_section",
]);

const DESIGN_WORDS =
  /\b(design|redesign|re-design|theme|look and feel|looks?|feel|style|styling|colou?rs?|palette|fonts?|typography|typeface|layout|home ?page|hero|sections?|composition|dna|motion|animations?|animated|mobile|spacing|branding|vibe|aesthetic|modern|minimal(ist)?|bold|playful|luxury|luxurious|premium|editorial|streetwear|elegant|refresh|makeover|polish|more interesting|less boring|stand out|visual)\b/i;

const WRITE_WORDS =
  /\b(create|add|make|set|update|change|edit|rename|delete|remove|archive|publish|unpublish|discount|refund|cancel|fulfil|fulfill|ship|tag|send|draft|launch|start|stop|pause|resume|apply|restore|undo|increase|decrease|raise|lower|cut|put|move|reorder|hide|unhide|enable|disable|import|generate|write|rewrite|fix|mark|schedule|issue|bump|reduce|double|halve|turn (on|off)|clear|reset|adjust|price|reprice)\b/i;

const READ_HINTS =
  /^(what|which|who|how|when|where|why|is|are|do|does|did|can you tell|tell me|show|list|give me|summari[sz]e|break ?down|breakdown|report|compare|explain|any|find|search|look up|check|count|were|was|have|has|had)\b/i;

/** The tier a tool call belongs to, used for mid-request escalation. */
export function tierForTool(name: string, risk: string): RequestTier {
  if (DESIGN_TOOLS.has(name)) return "design";
  return risk === "read" ? "light" : "standard";
}

/** The tier implied by the previous assistant turn, so short follow-ups ("yes, do that") stay in context. */
export function tierFromHistory(calls: StoredToolCall[] | null | undefined): RequestTier {
  let tier: RequestTier = "light";
  for (const call of calls ?? []) {
    tier = higherTier(tier, tierForTool(call.name, call.risk ?? "read"));
  }
  return tier;
}

export function classifyMessage(message: string, previousTier: RequestTier = "light"): RequestTier {
  const text = message.trim();
  let tier: RequestTier;
  if (DESIGN_WORDS.test(text)) tier = "design";
  else if (WRITE_WORDS.test(text)) tier = "standard";
  else if (READ_HINTS.test(text) || text.includes("?") || text.length < 160) tier = "light";
  else tier = "standard";

  // A short reply inside a design or write conversation continues that work.
  if (text.length < 80) tier = higherTier(tier, previousTier);
  return tier;
}

export function lightModel(): string | null {
  const raw = process.env.AI_LIGHT_MODEL?.trim();
  if (raw?.toLowerCase() === "off") return null;
  return raw || DEFAULT_LIGHT_MODEL;
}

/** Whether a model accepts output_config.effort (Sonnet 5, Opus 5, Fable, Opus 4.6+). */
export function supportsEffort(model: string): boolean {
  return /^claude-(sonnet-5|opus-5|opus-4-[678]|fable|mythos)/.test(model);
}

export function decisionFor(tier: RequestTier, defaultModel: string): RouteDecision {
  if (tier === "light") {
    const model = lightModel();
    if (model && model !== defaultModel) return { tier, model, effort: null, maxTokens: 4000 };
    return { tier, model: defaultModel, effort: supportsEffort(defaultModel) ? "low" : null, maxTokens: 4000 };
  }
  if (tier === "standard") {
    return { tier, model: defaultModel, effort: supportsEffort(defaultModel) ? "medium" : null, maxTokens: 8000 };
  }
  return { tier, model: defaultModel, effort: supportsEffort(defaultModel) ? "high" : null, maxTokens: 16000 };
}

export function routeRequest(message: string, defaultModel: string, previousCalls?: StoredToolCall[] | null): RouteDecision {
  return decisionFor(classifyMessage(message, tierFromHistory(previousCalls)), defaultModel);
}
