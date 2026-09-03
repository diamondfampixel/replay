import { z } from "zod";
import { reportError } from "@/lib/monitoring";

export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function fromZodError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return {
    ok: false,
    error: error.issues[0]?.message ?? "Please check the highlighted fields.",
    fieldErrors,
  };
}

/** Wraps an action body so unexpected exceptions become typed failures. */
export async function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    // Next's redirect/notFound throw control-flow errors that must bubble.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
        (error as { digest: string }).digest === "NEXT_NOT_FOUND")
    ) {
      throw error;
    }
    // The app's convention: an Error thrown with a sentence is written for the
    // person using it ("This store is not available.") and is shown as-is.
    // Driver, runtime and upstream failures are not — those are reported and
    // replaced with a fixed message so internal text never reaches the browser.
    if (error instanceof Error && !isInternalError(error)) {
      const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors;
      return fail(error.message, fieldErrors);
    }
    reportError("action", error);
    return fail("Something went wrong on our side. Please try again.");
  }
}

const INTERNAL_ERROR_NAMES = /^(PrismaClient|TypeError|SyntaxError|RangeError|ReferenceError|AbortError|TimeoutError|APIError|APIConnection)/;
const INTERNAL_ERROR_TEXT = /prisma|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|relation "|column "|syntax error|Invalid `|Unique constraint|Foreign key constraint|is not a function|Cannot read properties|is not defined|fetch failed/i;

/** Errors nobody wrote for the operator: database, runtime, network, upstream. */
function isInternalError(error: Error): boolean {
  return INTERNAL_ERROR_NAMES.test(error.name) || INTERNAL_ERROR_TEXT.test(error.message);
}
