import type { Metadata } from "next";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { can } from "@/lib/permissions";
import { getDomainView } from "@/lib/services/domains";
import { DomainSettings } from "@/components/admin/domain-settings";

export const metadata: Metadata = { title: "Domain" };
export const dynamic = "force-dynamic";

export default async function DomainSettingsPage() {
  const auth = await requireCapability("settings:read");
  const ctx = await serviceContext();
  const view = await getDomainView(ctx);

  return (
    <DomainSettings
      storeSlug={auth.storeSlug}
      canWrite={can(auth.role, "settings:write")}
      initial={{
        host: view.host,
        kind: view.kind,
        status: view.status,
        error: view.error,
        verifiedAt: view.verifiedAt?.toISOString() ?? null,
        checkedAt: view.checkedAt?.toISOString() ?? null,
        records: view.records,
        hostingReady: view.hostingReady,
      }}
    />
  );
}
