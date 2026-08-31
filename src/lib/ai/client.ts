import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AIConfig } from "@/lib/ai/config";

export function createAnthropic(config: AIConfig) {
  return new Anthropic({ apiKey: config.apiKey, maxRetries: 2 });
}

export class AINotConfiguredError extends Error {
  constructor() {
    super(
      "The AI assistant is not configured. Add an Anthropic API key in Integrations, or set ANTHROPIC_API_KEY.",
    );
    this.name = "AINotConfiguredError";
  }
}

/** Extracts the first JSON object or array from a model response. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("The model did not return JSON.");
  const slice = candidate.slice(start);

  // Walk to the matching bracket so trailing prose is tolerated.
  const open = slice[0];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < slice.length; i++) {
    const char = slice[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === open) depth++;
    else if (char === close) {
      depth--;
      if (depth === 0) return JSON.parse(slice.slice(0, i + 1)) as T;
    }
  }
  throw new Error("The model returned malformed JSON.");
}

/**
 * Turns a provider failure into something an operator can act on without
 * echoing the upstream body back to the browser. The raw error is worth
 * logging, but it can quote the request that triggered it, so only the shape
 * of the failure — not its text — reaches the client.
 */
export function providerErrorMessage(error: unknown): string | null {
  if (error instanceof AINotConfiguredError) return error.message;
  if (!(error instanceof Anthropic.APIError)) return null;

  switch (error.status) {
    case 401:
    case 403:
      return "The configured Anthropic API key was rejected. Check it under Integrations.";
    case 404:
      return "The configured model is unavailable for this API key.";
    case 429:
      return "The Anthropic API rate limit was reached. Try again shortly.";
    case 400:
      return "The assistant sent a request the API rejected. The details are in the server log.";
    default:
      return error.status && error.status >= 500
        ? "The Anthropic API is unavailable right now. Try again shortly."
        : null;
  }
}
