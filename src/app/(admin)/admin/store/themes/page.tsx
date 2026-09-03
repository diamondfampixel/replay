import type { Metadata } from "next";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { listThemes } from "@/lib/services/themes";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { isStripeBillingConfigured } from "@/lib/stripe";
import { resolveTheme } from "@/lib/storefront/theme";
import { ThemeGallery, type GalleryTheme } from "@/components/admin/theme-gallery";

export const metadata: Metadata = { title: "Themes" };
export const dynamic = "force-dynamic";

export default async function ThemesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireCapability("storefront:read");
  const ctx = await serviceContext();
  const params = await searchParams;
  const [themes, store] = await Promise.all([
    listThemes(ctx),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { slug: true, primaryColor: true, secondaryColor: true } }),
  ]);
  // Resolved tokens power the original CSS previews on every card — no screenshots, no imagery.
  const gallery: GalleryTheme[] = themes.map((t) => {
    const resolved = resolveTheme({ theme: t.theme, primaryColor: t.theme.accent ?? store.primaryColor, secondaryColor: store.secondaryColor });
    return {
      id: t.id, name: t.name, tier: t.tier, category: t.category, tags: t.tags, tagline: t.tagline, description: t.description, features: t.features,
      priceCents: t.priceCents, owned: t.owned, active: t.active, swatch: t.swatch,
      vars: resolved.vars, fontFamilies: resolved.fontFamilies.map((f) => ({ family: f.family, weights: f.weights })),
      cardStyle: resolved.cardStyle, heroLayout: String(t.recipe.find((s) => s.type === "hero" || s.type === "imageHero" || s.type === "videoHero")?.layout ?? "left"),
      sections: t.recipe.map((s) => `${s.type}${s.layout ? `:${s.layout}` : ""}`),
      headerStyle: resolved.header.style, isDark: resolved.isDark,
    };
  });
  return (
    <ThemeGallery
      themes={gallery}
      storeSlug={store.slug}
      canWrite={can(auth.role, "storefront:write")}
      canBuy={can(auth.role, "billing:manage")}
      paymentsConfigured={isStripeBillingConfigured()}
      purchaseState={params.purchase ?? null}
    />
  );
}
