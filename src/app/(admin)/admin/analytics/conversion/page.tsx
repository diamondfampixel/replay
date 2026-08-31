import { requireCapability } from "@/lib/session";
import {
  getConversionFunnel, getOverviewMetrics, getTimeseries, resolveRange,
} from "@/lib/services/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/admin/metric-card";
import { TrendChart } from "@/components/admin/charts";
import { formatNumber } from "@/lib/money";

export default async function ConversionAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireCapability("analytics:read");
  const params = await searchParams;
  const range = resolveRange(params.range, params.from, params.to);

  const [funnel, metrics, series] = await Promise.all([
    getConversionFunnel(ctx.storeId, range),
    getOverviewMetrics(ctx.storeId, range),
    getTimeseries(ctx.storeId, range),
  ]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Conversion rate" metric={metrics.conversionRate} format="percent"
          hint="Orders divided by sessions." />
        <MetricCard label="Add-to-cart rate" metric={metrics.addToCartRate} format="percent"
          hint="Add-to-cart events divided by product views." />
        <MetricCard label="Checkout completion" metric={metrics.checkoutRate} format="percent"
          hint="Orders divided by checkouts started." />
        <MetricCard label="Average order value" metric={metrics.averageOrderValue} format="money" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funnel</CardTitle>
          <span className="text-[12.5px] text-ink-500">{range.label}</span>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {funnel.map((step, index) => (
              <li key={step.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] font-medium text-ink-800">{step.label}</span>
                  <span className="tabular text-[15px] font-semibold text-ink-900">
                    {formatNumber(step.value)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-pine-600 transition-all"
                    style={{ width: `${Math.max(step.rateFromTop, 0.5)}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[11.5px] text-ink-400">
                  <span>{step.rateFromTop.toFixed(1)}% of visitors</span>
                  {index > 0 && step.rateFromPrevious !== null && (
                    <span>
                      {step.rateFromPrevious.toFixed(1)}% of {funnel[index - 1].label.toLowerCase()} ·{" "}
                      {(100 - step.rateFromPrevious).toFixed(1)}% drop-off
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Conversion rate over time</CardTitle></CardHeader>
        <CardContent className="pl-1">
          <TrendChart data={series} dataKey="conversionRate" name="Conversion rate" format="percent"
            variant="line" color="var(--color-chart-4)" height={220} />
        </CardContent>
      </Card>
    </div>
  );
}
