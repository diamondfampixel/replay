import { requireCapability } from "@/lib/session";
import { PageHeader } from "@/components/ui/page";
import { SettingsNav } from "@/components/admin/settings-nav";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCapability("settings:read");

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title="Settings" description="Store configuration, team and platform preferences." />
      <div className="grid gap-6 lg:grid-cols-[190px_1fr]">
        <SettingsNav role={ctx.role} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
