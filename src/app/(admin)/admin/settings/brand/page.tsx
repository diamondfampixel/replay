import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { can } from "@/lib/permissions";
import { BrandSettingsForm } from "@/components/admin/settings-forms";

export const metadata: Metadata = { title: "Brand" };

export default async function BrandSettingsPage() {
  const ctx = await requireCapability("settings:read");
  const store = await prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId } });

  return (
    <BrandSettingsForm
      canWrite={can(ctx.role, "settings:write")}
      initial={{
        logoUrl: store.logoUrl,
        primaryColor: store.primaryColor,
        secondaryColor: store.secondaryColor,
        fontHeading: store.fontHeading,
        fontBody: store.fontBody,
      }}
    />
  );
}
