import { requireCapability } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  getOverviewMetrics, getSalesByCollection, getTimeseries, resolveRange,
} from "@/lib/services/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/admin/metric-card";
import { TrendChart, HorizontalBars } from "@/components/admin/charts";
import { EmptyState } from "@/components/ui/states";

export default async function SalesAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireCapability("analytics:read");
  const params = await searchParams;
  const range = resolveRange(params.range, params.from, params.to);

  const [metrics, series, byCollection, store] = await Promise.all([
    getOverviewMetrics(ctx.storeId, range),
    getTimeseries(ctx.storeId, range),
    getSalesByCollection(ctx.storeId, range),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
  ]);
  const currency = store.currency;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Gross sales" metric={metrics.grossSales} format="money" currency={currency}
          hint="Sum of line item totals before discounts and refunds." />
        <MetricCard label="Discounts" metric={metrics.discounts} format="money" currency={currency} invert />
        <MetricCard label="Refunds" metric={metrics.refunds} format="money" currency={currency} invert />
        <MetricCard label="Net sales" metric={metrics.netSales} format="money" currency={currency}
          hint="Gross sales less discounts and refunds." />
        <MetricCard label="Revenue" metric={metrics.revenue} format="money" currency={currency}
          hint="Order totals (including shipping and tax) less refunds." />
        <MetricCard label="Orders" metric={metrics.orders} />
        <MetricCard label="Units sold" metric={metrics.unitsSold} />
        <MetricCard label="Average order value" metric={metrics.averageOrderValue} format="money" currency={currency} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue</CardTitle></CardHeader>
          <CardContent className="pl-1">
            <TrendChart data={series} dataKey="revenue" name="Revenue" format="money" currency={currency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Orders</CardTitle></CardHeader>
          <CardContent className="pl-1">
            <TrendChart data={series} dataKey="orders" name="Orders" variant="bar" color="var(--color-chart-2)" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Sales by collection</CardTitle></CardHeader>
        <CardContent>
          {byCollection.length === 0 ? (
            <EmptyState title="No collection sales in this period" />
          ) : (
            <HorizontalBars
              data={byCollection.map((row) => ({ label: row.title, value: row.revenue }))}
              format="money"
              currency={currency}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
