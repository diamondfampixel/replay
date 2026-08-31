import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowUpRight, ExternalLink, FlaskConical, PackageSearch, Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import {
  getConversionFunnel, getOverviewMetrics, getTimeseries, getTopProducts,
  getTrafficSources, rangeContainsDemoData, resolveRange,
} from "@/lib/services/analytics";
import { formatMoney, formatNumber, toNumber } from "@/lib/money";
import { formatDate, relativeTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoTag, EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";
import { MetricCard } from "@/components/admin/metric-card";
import { RangePicker } from "@/components/admin/range-picker";
import { TrendChart, HorizontalBars } from "@/components/admin/charts";
import { PAYMENT_TONE, FULFILLMENT_TONE } from "@/lib/status";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireCapability("analytics:read");
  const params = await searchParams;
  const range = resolveRange(params.range, params.from, params.to);

  const [
    metrics, series, topProducts, sources, funnel, recentOrders,
    experiments, store, aiActions, hasDemo,
  ] = await Promise.all([
    getOverviewMetrics(ctx.storeId, range),
    getTimeseries(ctx.storeId, range),
    getTopProducts(ctx.storeId, range, 5),
    getTrafficSources(ctx.storeId, range),
    getConversionFunnel(ctx.storeId, range),
    prisma.order.findMany({
      where: { storeId: ctx.storeId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true, number: true, email: true, total: true, createdAt: true,
        paymentStatus: true, fulfillmentStatus: true, isDemo: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.experiment.findMany({
      where: { storeId: ctx.storeId, status: "RUNNING" },
      select: { id: true, name: true, testType: true, startedAt: true, _count: { select: { variants: true } } },
      take: 4,
    }),
    prisma.store.findUniqueOrThrow({
      where: { id: ctx.storeId },
      select: { name: true, slug: true, status: true, currency: true, domain: true },
    }),
    prisma.aIAction.findMany({
      where: { storeId: ctx.storeId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, tool: true, status: true, createdAt: true, prompt: true },
    }),
    rangeContainsDemoData(ctx.storeId, range),
  ]);

  const currency = store.currency;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={`Good to see you, ${ctx.user.name.split(" ")[0]}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>
              {store.name} · {range.label}
            </span>
            {hasDemo && <DemoTag label="Includes demo data" />}
          </span>
        }
        actions={
          <>
            <RangePicker current={range.key} label={range.label} />
            <Button asChild size="sm" variant="secondary">
              <a href={`/s/${store.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink />
                View store
              </a>
            </Button>
          </>
        }
      />

      {hasDemo && (
        <div className="mb-5 rounded-lg border border-ink-200 bg-white px-4 py-3 text-[13px] text-ink-600">
          <span className="font-medium text-ink-900">This store contains seeded demo data.</span>{" "}
          Orders, traffic and experiment results below are generated for development and are not
          real business performance. Every seeded record is flagged in the database and can be
          removed from <Link href="/admin/settings/data" className="text-pine-700 hover:underline">Settings → Data</Link>.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Revenue" metric={metrics.revenue} format="money" currency={currency} />
        <MetricCard label="Orders" metric={metrics.orders} />
        <MetricCard label="Visitors" metric={metrics.visitors} />
        <MetricCard label="Conversion rate" metric={metrics.conversionRate} format="percent" />
        <MetricCard label="Average order value" metric={metrics.averageOrderValue} format="money" currency={currency} />
        <MetricCard label="Units sold" metric={metrics.unitsSold} />
        <MetricCard label="New customers" metric={metrics.newCustomers} />
        <MetricCard label="Refunds" metric={metrics.refunds} format="money" currency={currency} invert />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <Badge tone="outline">{range.label}</Badge>
          </CardHeader>
          <CardContent className="pl-1">
            <TrendChart data={series} dataKey="revenue" name="Revenue" format="money" currency={currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversion funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel.map((step, index) => (
              <div key={step.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] text-ink-700">{step.label}</span>
                  <span className="tabular text-[13px] font-medium text-ink-900">
                    {formatNumber(step.value)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-pine-600"
                    style={{ width: `${Math.max(step.rateFromTop, 0.5)}%` }}
                  />
                </div>
                {index > 0 && (
                  <p className="mt-1 text-[11.5px] text-ink-400">
                    {step.rateFromPrevious?.toFixed(1)}% of previous step
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders over time</CardTitle>
          </CardHeader>
          <CardContent className="pl-1">
            <TrendChart data={series} dataKey="orders" name="Orders" variant="bar" color="var(--color-chart-2)" height={200} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Visitors over time</CardTitle>
          </CardHeader>
          <CardContent className="pl-1">
            <TrendChart data={series} dataKey="visitors" name="Visitors" variant="line" color="var(--color-chart-3)" height={200} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <Link href="/admin/analytics/products" className="text-[12px] text-pine-700 hover:underline">
              All products
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {topProducts.length === 0 ? (
              <EmptyState icon={PackageSearch} title="No sales in this period" />
            ) : (
              <ul className="divide-y divide-ink-200">
                {topProducts.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.imageUrl ?? "/placeholder.svg"}
                        alt=""
                        className="size-9 shrink-0 rounded border border-ink-200 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink-800">{product.title}</p>
                        <p className="text-[11.5px] text-ink-500">{product.units} units</p>
                      </div>
                      <span className="tabular text-[13px] font-medium text-ink-900">
                        {formatMoney(product.revenue, currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Traffic sources</CardTitle>
            <Link href="/admin/analytics/traffic" className="text-[12px] text-pine-700 hover:underline">
              Details
            </Link>
          </CardHeader>
          <CardContent>
            {sources.length === 0 ? (
              <EmptyState title="No traffic recorded yet" />
            ) : (
              <HorizontalBars data={sources.map((s) => ({ label: s.source, value: s.sessions }))} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Store status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px]">
            <Row label="Status">
              <Badge tone={store.status === "ACTIVE" ? "success" : "warning"}>
                <Dot tone={store.status === "ACTIVE" ? "success" : "warning"} />
                {store.status === "ACTIVE" ? "Live" : store.status.toLowerCase()}
              </Badge>
            </Row>
            <Row label="Domain">
              <span className="truncate text-ink-700">{store.domain ?? "—"}</span>
            </Row>
            <Row label="Storefront">
              <a href={`/s/${store.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-pine-700 hover:underline">
                /s/{store.slug}
                <ArrowUpRight className="size-3" />
              </a>
            </Row>
            <Row label="Currency">
              <span className="text-ink-700">{store.currency}</span>
            </Row>
            <div className="border-t border-ink-200 pt-3">
              <Button asChild size="sm" variant="secondary" className="w-full">
                <Link href="/admin/store">Manage storefront</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <Link href="/admin/orders" className="text-[12px] text-pine-700 hover:underline">
              All orders
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <EmptyState title="No orders yet" description="Orders placed on your storefront appear here." />
            ) : (
              <ul className="divide-y divide-ink-200">
                {recentOrders.map((order) => (
                  <li key={order.id}>
                    <Link href={`/admin/orders/${order.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink-50">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-[13px] font-medium text-ink-800">
                          #{order.number}
                          {order.isDemo && <DemoTag label="Demo" />}
                        </p>
                        <p className="truncate text-[11.5px] text-ink-500">
                          {order.customer
                            ? `${order.customer.firstName} ${order.customer.lastName}`
                            : order.email}{" "}
                          · {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <Badge tone={PAYMENT_TONE[order.paymentStatus]}>
                        {order.paymentStatus.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                      <Badge tone={FULFILLMENT_TONE[order.fulfillmentStatus]}>
                        {order.fulfillmentStatus.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                      <span className="tabular w-20 shrink-0 text-right text-[13px] font-medium text-ink-900">
                        {formatMoney(toNumber(order.total), currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Active experiments</CardTitle>
              <Link href="/admin/experiments" className="text-[12px] text-pine-700 hover:underline">
                All tests
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {experiments.length === 0 ? (
                <EmptyState
                  icon={FlaskConical}
                  title="No experiments running"
                  description="Test a headline, image or price display against a control."
                  action={{ label: "Create a test", href: "/admin/experiments/new" }}
                />
              ) : (
                <ul className="divide-y divide-ink-200">
                  {experiments.map((experiment) => (
                    <li key={experiment.id}>
                      <Link href={`/admin/experiments/${experiment.id}`} className="block px-4 py-2.5 hover:bg-ink-50">
                        <p className="truncate text-[13px] font-medium text-ink-800">{experiment.name}</p>
                        <p className="text-[11.5px] text-ink-500">
                          {experiment._count.variants} variants ·{" "}
                          {experiment.startedAt ? `started ${relativeTime(experiment.startedAt)}` : "not started"}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent AI actions</CardTitle>
              <Link href="/admin/activity" className="text-[12px] text-pine-700 hover:underline">
                Activity log
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {aiActions.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="No AI actions yet"
                  description="Ask the assistant to change something and it will be logged here."
                  action={{ label: "Open assistant", href: "/admin/assistant" }}
                />
              ) : (
                <ul className="divide-y divide-ink-200">
                  {aiActions.map((action) => (
                    <li key={action.id} className="px-4 py-2.5">
                      <p className="font-mono text-[12px] text-ink-800">{action.tool}</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-ink-500">
                        {action.prompt ?? "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {action.status.replace(/_/g, " ").toLowerCase()} · {relativeTime(action.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      {children}
    </div>
  );
}
