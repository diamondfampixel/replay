import { hasPremiumDesign } from "@/lib/storefront/premium";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { can } from "@/lib/permissions";
import { storeThemeSchema } from "@/lib/storefront/theme";
import { DesignSettingsForm } from "@/components/admin/design-settings-form";

export const metadata: Metadata = { title: "Design" };

export default async function DesignSettingsPage() {
  const ctx = await requireCapability("settings:read");
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: ctx.storeId },
    select: { theme: true, primaryColor: true, secondaryColor: true, slug: true },
  });
  const parsed = storeThemeSchema.safeParse(store.theme ?? {});
  const theme = parsed.success ? parsed.data : storeThemeSchema.parse({});

  return (
    <DesignSettingsForm
      initial={theme}
      primaryColor={store.primaryColor}
      secondaryColor={store.secondaryColor}
      storeSlug={store.slug}
      canWrite={can(ctx.role, "settings:write")}
      premiumUnlocked={await hasPremiumDesign(ctx.organizationId, ctx.storeId)}
    />
  );
}
