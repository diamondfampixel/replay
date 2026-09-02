import { prisma, type Prisma } from "@/lib/db";
import {
  DIRECTION_PRESETS,
  storeThemeSchema,
  type DesignDirection,
  type StoreTheme,
} from "@/lib/storefront/theme";

/**
 * Applies a design change to a store's theme by MERGING over what is stored.
 *
 * The AI designer and the settings UI both go through here, so a change is
 * always a validated, structured theme — never arbitrary CSS. Passing a new
 * `direction` resets the token overrides to that direction's coordinated
 * defaults (a real "new look"); passing individual tokens nudges the current
 * look without losing the rest.
 */
export async function applyStoreTheme(
  storeId: string,
  patch: Partial<StoreTheme>,
): Promise<StoreTheme> {
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { theme: true },
  });
  const current = storeThemeSchema.safeParse(store.theme ?? {});
  const base: StoreTheme = current.success ? current.data : storeThemeSchema.parse({});

  // A direction switch is a fresh start: keep only an explicit accent unless the
  // patch overrides it, so "make it luxury" doesn't inherit the old radius.
  const next: StoreTheme =
    patch.direction && patch.direction !== base.direction
      ? storeThemeSchema.parse({ direction: patch.direction, accent: patch.accent ?? base.accent, ...patch })
      : storeThemeSchema.parse({ ...base, ...patch });

  await prisma.store.update({
    where: { id: storeId },
    data: { theme: next as Prisma.InputJsonValue },
  });
  return next;
}

/** Reads a store's stored theme, filling defaults. */
export async function getStoreTheme(storeId: string): Promise<StoreTheme> {
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { theme: true },
  });
  const parsed = storeThemeSchema.safeParse(store.theme ?? {});
  return parsed.success ? parsed.data : storeThemeSchema.parse({});
}

/** Human summary of a direction, for confirmations and the settings UI. */
export function describeDirection(direction: DesignDirection): string {
  return DIRECTION_PRESETS[direction].blurb;
}
