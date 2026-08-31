import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { can } from "@/lib/permissions";
import { GeneralSettingsForm } from "@/components/admin/settings-forms";

export const metadata: Metadata = { title: "General settings" };

export default async function GeneralSettingsPage() {
  const ctx = await requireCapability("settings:read");
  const store = await prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId } });

  return (
    <GeneralSettingsForm
      canWrite={can(ctx.role, "settings:write")}
      initial={{
        name: store.name,
        description: store.description ?? "",
        contactEmail: store.contactEmail ?? "",
        supportPhone: store.supportPhone ?? "",
        currency: store.currency,
        timezone: store.timezone,
        industry: store.industry ?? "",
        targetCustomer: store.targetCustomer ?? "",
        brandPersonality: store.brandPersonality ?? "",
      }}
    />
  );
}
