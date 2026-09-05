import "server-only";
import { prisma } from "@/lib/db";
import { getCatalogTheme } from "@/lib/storefront/themes";

/**
 * Whether a store may use premium-only design features (premium sections,
 * the editorial product layout). True when the organization owns any premium
 * theme, or the store's active theme is a premium one. Checked server-side
 * wherever a section or layout is added; rendering never re-checks, so a
 * storefront that already carries premium sections keeps them.
 */
export async function hasPremiumDesign(organizationId: string, storeId: string): Promise<boolean> {
  const [purchase, store] = await Promise.all([
    prisma.themePurchase.findFirst({ where: { organizationId, status: "PAID" }, select: { id: true } }),
    prisma.store.findUnique({ where: { id: storeId }, select: { activeThemeId: true } }),
  ]);
  if (purchase) return true;
  const active = store?.activeThemeId ? getCatalogTheme(store.activeThemeId) : null;
  return Boolean(active && active.tier !== "included");
}

export const PREMIUM_LOCK_MESSAGE =
  "This is a premium theme feature. It comes with any premium theme from the Themes gallery.";
