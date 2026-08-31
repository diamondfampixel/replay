import type { z } from "zod";

/**
 * Parses a partial update while dropping keys the caller did not send.
 *
 * `schema.partial().parse({})` still materialises every field that declares a
 * Zod `.default(...)`, which would silently clear columns like `tags` on an
 * update that never mentioned them. Intersecting with the raw keys keeps a
 * partial update genuinely partial.
 */
export function parseProvided<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
  raw: unknown,
): Partial<z.infer<z.ZodObject<Shape>>> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const parsed = schema.partial().parse(input) as Record<string, unknown>;
  const provided = new Set(Object.keys(input));
  return Object.fromEntries(
    Object.entries(parsed).filter(([key]) => provided.has(key)),
  ) as Partial<z.infer<z.ZodObject<Shape>>>;
}
