import "server-only";
import { Prisma, prisma } from "@/lib/db";
import { audit, authorize, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { createDesignSnapshot } from "@/lib/services/snapshots";
import { THEME_CATALOG, getCatalogTheme, themePriceCents, type CatalogTheme } from "@/lib/storefront/themes";
import { resolveTheme, storeThemeSchema, type ResolvedTheme } from "@/lib/storefront/theme";
import { composeFromRecipe, type ComposeBrief, type ComposedSection } from "@/lib/storefront/compose";
import { normaliseSectionConfig } from "@/lib/storefront/sections";

export type ThemeListing = CatalogTheme & { priceCents: number; owned: boolean; active: boolean };

/** Every catalogue theme with this organisation's ownership + the store's active theme. */
export async function listThemes(ctx: ServiceContext): Promise<ThemeListing[]> {
  authorize(ctx, "storefront:read");
  const [purchases, store] = await Promise.all([
    prisma.themePurchase.findMany({ where: { organizationId: ctx.organizationId, status: "PAID" }, select: { themeId: true } }),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { activeThemeId: true } }),
  ]);
  const owned = new Set(purchases.map((p) => p.themeId));
  return THEME_CATALOG.map((theme) => ({
    ...theme,
    priceCents: themePriceCents(theme),
    owned: theme.tier === "included" || owned.has(theme.id),
    active: store.activeThemeId === theme.id,
  }));
}

/** Included themes are always usable; premium themes need a PAID purchase by this organisation. */
export async function isThemeEntitled(organizationId: string, theme: CatalogTheme): Promise<boolean> {
  if (theme.tier === "included") return true;
  const purchase = await prisma.themePurchase.findFirst({ where: { organizationId, themeId: theme.id, status: "PAID" }, select: { id: true } });
  return Boolean(purchase);
}

/** The brief a theme is rendered with: the merchant's own store, never invented facts. */
async function briefFor(storeId: string): Promise<ComposeBrief> {
  const [store, productCount, collections, reviewCount, newest, withImages] = await Promise.all([
    prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { name: true, description: true, industry: true } }),
    prisma.product.count({ where: { storeId, status: "ACTIVE" } }),
    prisma.collection.findMany({ where: { storeId, visible: true }, select: { slug: true }, orderBy: { position: "asc" }, take: 6 }),
    prisma.review.count({ where: { storeId, status: "PUBLISHED" } }),
    prisma.product.findFirst({ where: { storeId, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, select: { id: true } }),
    prisma.product.findMany({
      where: { storeId, status: "ACTIVE", images: { some: {} } },
      select: { title: true, slug: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } } },
      orderBy: { createdAt: "desc" }, take: 6,
    }),
  ]);
  return {
    name: store.name, description: store.description, industry: store.industry, goal: "catalog",
    catalog: {
      productCount, collectionSlugs: collections.map((c) => c.slug), featuredProductId: newest?.id ?? null, hasReviews: reviewCount > 0,
      looks: withImages.map((p) => ({ url: p.images[0].url, alt: p.images[0].alt ?? "", title: p.title, slug: p.slug })),
    },
  };
}

/**
 * Resolves a catalogue theme against a store: the resolved design tokens plus
 * a homepage composed from the theme's recipe and the merchant's own content.
 * Pure — nothing is written. Used by live preview and by apply.
 */
export async function renderThemeForStore(storeId: string, theme: CatalogTheme): Promise<{ resolved: ResolvedTheme; sections: ComposedSection[] }> {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { primaryColor: true, secondaryColor: true } });
  const stored = storeThemeSchema.parse(theme.theme);
  const resolved = resolveTheme({ theme: stored, primaryColor: stored.accent ?? store.primaryColor, secondaryColor: store.secondaryColor });
  const sections = composeFromRecipe(resolved, await briefFor(storeId), theme.recipe);
  return { resolved, sections };
}

/**
 * Applies a theme: snapshot first (always), then write the structured theme
 * and a freshly composed homepage onto the live rows. Existing merchant media
 * on same-type sections is carried across so a hero image survives a theme
 * change. Premium themes require entitlement; the check is server-side.
 */
export async function applyTheme(ctx: ServiceContext, themeId: string) {
  authorize(ctx, "storefront:write");
  const theme = getCatalogTheme(themeId);
  if (!theme) throw new NotFoundError("Theme");
  if (!(await isThemeEntitled(ctx.organizationId, theme))) throw new ValidationError(`"${theme.name}" is a premium theme. Buy it to apply it.`);

  const snapshot = await createDesignSnapshot(ctx, { label: `Before applying "${theme.name}"`, source: "auto" });
  const { sections } = await renderThemeForStore(ctx.storeId, theme);
  const page = await prisma.page.findFirst({ where: { storeId: ctx.storeId, type: "HOME" }, include: { sections: { orderBy: { position: "asc" } } } });

  // Carry merchant media forward where the new recipe has the same section type.
  const previousMedia = new Map<string, unknown>();
  for (const s of page?.sections ?? []) {
    const cfg = (s.config ?? {}) as Record<string, unknown>;
    const media = cfg.media as { url?: string | null } | undefined;
    if (media?.url && !previousMedia.has(s.type)) previousMedia.set(s.type, media);
  }
  const merged = sections.map((s) => {
    const media = previousMedia.get(s.type);
    return { ...s, config: normaliseSectionConfig(s.type, media ? { ...s.config, media } : s.config) };
  });

  await prisma.$transaction(async (tx) => {
    await tx.store.update({ where: { id: ctx.storeId }, data: { theme: storeThemeSchema.parse(theme.theme) as Prisma.InputJsonValue, activeThemeId: theme.id } });
    if (page) {
      await tx.pageSection.deleteMany({ where: { pageId: page.id } });
      for (const [index, s] of merged.entries()) {
        await tx.pageSection.create({ data: { pageId: page.id, type: s.type, position: index, visible: true, config: s.config as Prisma.InputJsonValue } });
      }
      await tx.page.update({ where: { id: page.id }, data: { draftSections: Prisma.DbNull, publishedAt: new Date() } });
    }
  });
  await audit(ctx, "theme.apply", { type: "Store", id: ctx.storeId }, { themeId: theme.id, tier: theme.tier, snapshotId: snapshot.id });
  return { theme: { id: theme.id, name: theme.name }, snapshotId: snapshot.id, sections: merged.length };
}

/**
 * Records a completed one-time purchase. Called only from the signature-
 * verified Stripe webhook (or a development fixture) — never from a client.
 * Idempotent on the Stripe session id.
 */
export async function recordThemePurchase(input: { organizationId: string; themeId: string; amountCents: number; currency?: string; stripeSessionId?: string | null; stripePaymentIntentId?: string | null }) {
  const theme = getCatalogTheme(input.themeId);
  if (!theme) throw new NotFoundError("Theme");
  if (input.stripeSessionId) {
    const existing = await prisma.themePurchase.findUnique({ where: { stripeSessionId: input.stripeSessionId } });
    if (existing) return existing;
  }
  return prisma.themePurchase.create({
    data: {
      organizationId: input.organizationId, themeId: theme.id, amountCents: input.amountCents, currency: input.currency ?? "usd",
      status: "PAID", stripeSessionId: input.stripeSessionId ?? null, stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    },
  });
}
