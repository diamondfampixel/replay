import type { Metadata } from "next";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { getBillingView } from "@/lib/services/billing";
import { BillingSettings } from "@/components/admin/billing-settings";

export const metadata: Metadata = { title: "Plan & billing" };

export default async function BillingPage() {
  await requireCapability("billing:manage");
  const ctx = await serviceContext();
  const view = await getBillingView(ctx);

  return (
    <BillingSettings
      planId={view.plan.id}
      planStatus={view.planStatus}
      billingCycle={view.billingCycle}
      cancelAtPeriodEnd={view.cancelAtPeriodEnd}
      billingConnected={view.billingConnected}
      usage={view.usage}
    />
  );
}
