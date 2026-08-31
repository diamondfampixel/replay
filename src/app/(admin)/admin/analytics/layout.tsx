import Link from "next/link";
import { requireCapability } from "@/lib/session";
import { AnalyticsTabs } from "@/components/admin/analytics-tabs";
import { PageHeader } from "@/components/ui/page";
import { RangePicker } from "@/components/admin/range-picker";
import { resolveRange } from "@/lib/ranges";

export const dynamic = "force-dynamic";

export default async function AnalyticsLayout({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  await requireCapability("analytics:read");
  const params = (await searchParams) ?? {};
  const range = resolveRange(params.range, params.from, params.to);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Analytics"
        description="Every number here is computed from your order and event tables."
        actions={
          <>
            <RangePicker current={range.key} label={range.label} />
            <Link
              href="/admin/activity"
              className="text-[12.5px] text-ink-500 hover:text-ink-800"
            >
              Data sources
            </Link>
          </>
        }
      />
      <AnalyticsTabs />
      <div className="mt-5">{children}</div>
    </div>
  );
}
