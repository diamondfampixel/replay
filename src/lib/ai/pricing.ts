/**
 * Anthropic list prices, USD per million tokens, used to estimate what every
 * AI request costs Halyard. Estimates only — the invoice from Anthropic is the
 * truth — but they are exact enough to keep the plans honest and to trip the
 * spend ceilings before a runaway request becomes a runaway bill.
 *
 * Pure module (no server-only import) so the marketing/economics maths can be
 * unit-tested without a database.
 */
export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type ModelPrice = {
  /** Uncached input tokens. */
  input: number;
  output: number;
  /** Prompt-cache reads (0.1× input). */
  cacheRead: number;
  /** Prompt-cache writes, 5-minute TTL (1.25× input). */
  cacheWrite: number;
};

/** Keys are model-id prefixes; a dated id like claude-haiku-4-5-20251001 matches its family. */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-4": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
};

/** Unknown models are priced as Sonnet — the product default and a safe middle. */
export const FALLBACK_PRICE: ModelPrice = MODEL_PRICES["claude-sonnet-5"];

export function priceFor(model: string): ModelPrice {
  const key = Object.keys(MODEL_PRICES)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => model.startsWith(prefix));
  return key ? MODEL_PRICES[key] : FALLBACK_PRICE;
}

/** Cost in micro-dollars (1e-6 USD), integer-safe for database columns. */
export function estimateCostMicros(model: string, usage: Partial<TokenUsage>): number {
  const price = priceFor(model);
  const micros =
    (usage.inputTokens ?? 0) * price.input +
    (usage.outputTokens ?? 0) * price.output +
    (usage.cacheReadTokens ?? 0) * price.cacheRead +
    (usage.cacheWriteTokens ?? 0) * price.cacheWrite;
  return Math.round(micros);
}

export function microsToUsd(micros: number): number {
  return micros / 1_000_000;
}

export function formatUsd(micros: number, digits = 2): string {
  return `$${microsToUsd(micros).toFixed(digits)}`;
}
