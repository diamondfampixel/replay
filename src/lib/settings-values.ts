import "server-only";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/money";
import type { PlatformValues } from "@/components/admin/settings-forms";

export async function loadPlatformValues(storeId: string): Promise<PlatformValues> {
  const settings = await prisma.storeSettings.findUnique({ where: { storeId } });
  return {
    freeShippingThreshold: settings?.freeShippingThreshold ? String(toNumber(settings.freeShippingThreshold)) : "",
    taxEnabled: settings?.taxEnabled ?? false,
    taxRate: settings ? String(toNumber(settings.taxRate) * 100) : "0",
    taxIncluded: settings?.taxIncluded ?? false,
    notifyNewOrder: settings?.notifyNewOrder ?? true,
    notifyLowInventory: settings?.notifyLowInventory ?? true,
    lowInventoryThreshold: String(settings?.lowInventoryThreshold ?? 5),
    notifyExperimentDone: settings?.notifyExperimentDone ?? true,
    aiConfirmHighImpact: settings?.aiConfirmHighImpact ?? true,
    aiTone: settings?.aiTone ?? "professional",
    aiAutoApplyLowRisk: settings?.aiAutoApplyLowRisk ?? true,
    checkoutMode: (settings?.checkoutMode as "simulated" | "stripe") ?? "simulated",
  };
}
