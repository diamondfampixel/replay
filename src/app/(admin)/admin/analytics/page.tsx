import { requireCapability } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  getConversionFunnel, getDeviceBreakdown, getOverviewMetrics, getTimeseries,
  getTrafficSources, rangeContainsDemoData, resolveRange,
} from "@/lib/services/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/admin/metric-card";
import { DonutChart, HorizontalBars, TrendChart } from "@/components/admin/charts";
import { DemoTag } from "@/components/ui/states";
import { formatNumber } from "@/lib/money";

export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireCapability("analytics:read");
  const params = await searchParams;
  const range = resolveRange(params.range, params.from, params.to);

  const [metrics, series, sources, devices, funnel, store, hasDemo] = await Promise.all([
    getOverviewMetrics(ctx.storeId, range),
    getTimeseries(ctx.storeId, range),
    getTrafficSources(ctx.storeId, range),
    getDeviceBreakdown(ctx.storeId, range),
    getConversionFunnel(ctx.storeId, range),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
    rangeContainsDemoData(ctx.storeId, range),
  ]);

  return (
    <div className="space-y-3">
      {hasDemo && (
        <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-[13px] text-ink-600">
          <DemoTag />
          This period includes seeded demo activity generated for development.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Revenue" metric={metrics.revenue} format="money" currency={store.currency} />
        <MetricCard label="Orders" metric={metrics.orders} />
        <MetricCard label="Sessions" metric={metrics.sessions} />
        <MetricCard label="Conversion rate" metric={metrics.conversionRate} format="percent" />
      </div>

      <Card>
        <CardHeader><CardTitle>Revenue over time</CardTitle></CardHeader>
        <CardContent className="pl-1">
          <TrendChart data={series} dataKey="revenue" name="Revenue" format="money" currency={store.currency} height={260} />
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Traffic sources</CardTitle></CardHeader>
          <CardContent>
            <HorizontalBars data={sources.map((s) => ({ label: s.source, value: s.sessions }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Device</CardTitle></CardHeader>
          <CardContent>
            <DonutChart data={devices.map((d) => ({ name: d.device, value: d.sessions }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Funnel</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {funnel.map((step) => (
              <div key={step.label}>
                <div className="flex items-baseline justify-between text-[12.5px]">
                  <span className="text-ink-700">{step.label}</span>
                  <span className="tabular font-medium text-ink-900">{formatNumber(step.value)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-pine-600" style={{ width: `${Math.max(step.rateFromTop, 0.5)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
