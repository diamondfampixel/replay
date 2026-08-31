import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { can } from "@/lib/permissions";
import { loadPlatformValues } from "@/lib/settings-values";
import { SettingsToggleForm } from "@/components/admin/settings-forms";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsSettingsPage() {
  const ctx = await requireCapability("settings:read");
  const [values, stripe] = await Promise.all([
    loadPlatformValues(ctx.storeId),
    prisma.integration.findUnique({
      where: { storeId_provider: { storeId: ctx.storeId, provider: "stripe" } },
    }),
  ]);

  return (
    <SettingsToggleForm
      section="payments"
      initial={values}
      canWrite={can(ctx.role, "settings:write")}
      stripeConnected={stripe?.status === "CONNECTED" || Boolean(process.env.STRIPE_SECRET_KEY)}
    />
  );
}
