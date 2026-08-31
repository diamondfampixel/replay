import { z } from "zod";

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
    console.error("[action]", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return fail(message);
  }
}
