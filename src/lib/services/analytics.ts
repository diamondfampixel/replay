import "server-only";
import { prisma } from "@/lib/db";
import { percentChange, round2, toNumber } from "@/lib/money";
import { TRAFFIC_SOURCES } from "@/lib/demo/catalog";
import { addDays, type DateRange } from "@/lib/ranges";

export { RANGE_PRESETS, resolveRange } from "@/lib/ranges";
export type { DateRange, RangeKey } from "@/lib/ranges";

/**
 * Two sources of truth, deliberately:
 *
 *  - Money and order counts come from the `Order` table, so anything created
 *    through the storefront, the admin or the AI is reflected immediately and
 *    exactly.
 *  - Traffic (sessions, views, cart events) comes from the `AnalyticsDaily`
 *    rollup, which the event ingest endpoint increments as events arrive.
 *
 * Nothing on a dashboard is computed in a React component.
 */

export type { MetricValue, SeriesPoint, FunnelStep } from "@/lib/analytics-types";
import type { MetricValue, SeriesPoint, FunnelStep } from "@/lib/analytics-types";

function metric(value: number, previous: number): MetricValue {
  return { value: round2(value), previous: round2(previous), change: percentChange(value, previous) };
}

async function orderTotals(storeId: string, from: Date, to: Date) {
  const [aggregate, units, customers] = await Promise.all([
    prisma.order.aggregate({
      where: { storeId, createdAt: { gte: from, lt: to } },
      _sum: { subtotal: true, total: true, discountTotal: true, refundedTotal: true, taxTotal: true, shippingTotal: true },
      _count: true,
    }),
    prisma.orderItem.aggregate({
      where: { order: { storeId, createdAt: { gte: from, lt: to } } },
      _sum: { quantity: true },
    }),
    prisma.customer.count({ where: { storeId, createdAt: { gte: from, lt: to } } }),
  ]);

  const gross = toNumber(aggregate._sum.subtotal);
  const discounts = toNumber(aggregate._sum.discountTotal);
  const refunds = toNumber(aggregate._sum.refundedTotal);
  const total = toNumber(aggregate._sum.total);

  return {
    orders: aggregate._count,
    grossSales: gross,
    discounts,
    refunds,
    netSales: round2(gross - discounts - refunds),
    revenue: round2(total - refunds),
    tax: toNumber(aggregate._sum.taxTotal),
    shipping: toNumber(aggregate._sum.shippingTotal),
    units: units._sum.quantity ?? 0,
    newCustomers: customers,
  };
}

async function trafficTotals(storeId: string, from: Date, to: Date) {
  const rows = await prisma.analyticsDaily.aggregate({
    where: { storeId, date: { gte: from, lt: to } },
    _sum: {
      visitors: true, sessions: true, pageViews: true, productViews: true,
      addToCarts: true, checkoutsStarted: true,
    },
  });
  return {
    visitors: rows._sum.visitors ?? 0,
    sessions: rows._sum.sessions ?? 0,
    pageViews: rows._sum.pageViews ?? 0,
    productViews: rows._sum.productViews ?? 0,
    addToCarts: rows._sum.addToCarts ?? 0,
    checkoutsStarted: rows._sum.checkoutsStarted ?? 0,
  };
}

export type OverviewMetrics = {
  revenue: MetricValue;
  orders: MetricValue;
  visitors: MetricValue;
  sessions: MetricValue;
  conversionRate: MetricValue;
  averageOrderValue: MetricValue;
  newCustomers: MetricValue;
  unitsSold: MetricValue;
  grossSales: MetricValue;
  netSales: MetricValue;
  refunds: MetricValue;
  discounts: MetricValue;
  addToCartRate: MetricValue;
  checkoutRate: MetricValue;
};

export async function getOverviewMetrics(storeId: string, range: DateRange): Promise<OverviewMetrics> {
  const [current, previous, traffic, previousTraffic] = await Promise.all([
    orderTotals(storeId, range.from, range.to),
    orderTotals(storeId, range.previousFrom, range.previousTo),
    trafficTotals(storeId, range.from, range.to),
    trafficTotals(storeId, range.previousFrom, range.previousTo),
  ]);

  const rate = (numerator: number, denominator: number) =>
    denominator > 0 ? (numerator / denominator) * 100 : 0;

  return {
    revenue: metric(current.revenue, previous.revenue),
    orders: metric(current.orders, previous.orders),
    visitors: metric(traffic.visitors, previousTraffic.visitors),
    sessions: metric(traffic.sessions, previousTraffic.sessions),
    conversionRate: metric(
      rate(current.orders, traffic.sessions),
      rate(previous.orders, previousTraffic.sessions),
    ),
    averageOrderValue: metric(
      current.orders ? current.revenue / current.orders : 0,
      previous.orders ? previous.revenue / previous.orders : 0,
    ),
    newCustomers: metric(current.newCustomers, previous.newCustomers),
    unitsSold: metric(current.units, previous.units),
    grossSales: metric(current.grossSales, previous.grossSales),
    netSales: metric(current.netSales, previous.netSales),
    refunds: metric(current.refunds, previous.refunds),
    discounts: metric(current.discounts, previous.discounts),
    addToCartRate: metric(
      rate(traffic.addToCarts, traffic.productViews),
      rate(previousTraffic.addToCarts, previousTraffic.productViews),
    ),
    checkoutRate: metric(
      rate(current.orders, traffic.checkoutsStarted),
      rate(previous.orders, previousTraffic.checkoutsStarted),
    ),
  };
}

export async function getTimeseries(storeId: string, range: DateRange): Promise<SeriesPoint[]> {
  const [daily, orders] = await Promise.all([
    prisma.analyticsDaily.findMany({
      where: { storeId, date: { gte: range.from, lt: range.to } },
      orderBy: { date: "asc" },
    }),
    prisma.order.findMany({
      where: { storeId, createdAt: { gte: range.from, lt: range.to } },
      select: { createdAt: true, total: true, refundedTotal: true, items: { select: { quantity: true } } },
    }),
  ]);

  const byDate = new Map<string, SeriesPoint>();
  for (
    let cursor = new Date(range.from);
    cursor < range.to;
    cursor = addDays(cursor, 1)
  ) {
    const key = cursor.toISOString().slice(0, 10);
    byDate.set(key, {
      date: key, revenue: 0, orders: 0, visitors: 0, sessions: 0, units: 0, conversionRate: 0,
    });
  }

  for (const row of daily) {
    const key = row.date.toISOString().slice(0, 10);
    const point = byDate.get(key);
    if (!point) continue;
    point.visitors = row.visitors;
    point.sessions = row.sessions;
  }

  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const point = byDate.get(key);
    if (!point) continue;
    point.revenue = round2(point.revenue + toNumber(order.total) - toNumber(order.refundedTotal));
    point.orders += 1;
    point.units += order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  for (const point of byDate.values()) {
    point.conversionRate = point.sessions ? round2((point.orders / point.sessions) * 100) : 0;
  }

  return [...byDate.values()];
}

export type TopProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  units: number;
  revenue: number;
  orders: number;
};

export async function getTopProducts(
  storeId: string,
  range: DateRange,
  limit = 5,
): Promise<TopProduct[]> {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { not: null },
      order: { storeId, createdAt: { gte: range.from, lt: range.to } },
    },
    _sum: { quantity: true, total: true },
    _count: { _all: true },
    orderBy: { _sum: { total: "desc" } },
    take: limit,
  });

  const ids = grouped.map((row) => row.productId!).filter(Boolean);
  if (!ids.length) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, images: { orderBy: { position: "asc" }, take: 1 } },
  });
  const map = new Map(products.map((p) => [p.id, p]));

  return grouped.map((row) => {
    const product = map.get(row.productId!);
    return {
      id: row.productId!,
      title: product?.title ?? "Deleted product",
      imageUrl: product?.images[0]?.url ?? null,
      units: row._sum.quantity ?? 0,
      revenue: toNumber(row._sum.total),
      orders: row._count._all,
    };
  });
}

export type SourceRow = { source: string; sessions: number; orders: number; revenue: number; conversionRate: number };

export async function getTrafficSources(storeId: string, range: DateRange): Promise<SourceRow[]> {
  const [daily, orders] = await Promise.all([
    prisma.analyticsDaily.findMany({
      where: { storeId, date: { gte: range.from, lt: range.to } },
      select: { sourceBreakdown: true },
    }),
    prisma.order.groupBy({
      by: ["source"],
      where: { storeId, createdAt: { gte: range.from, lt: range.to } },
      _count: true,
      _sum: { total: true },
    }),
  ]);

  const sessions = new Map<string, number>();
  for (const row of daily) {
    const breakdown = (row.sourceBreakdown ?? {}) as Record<string, number>;
    for (const [source, count] of Object.entries(breakdown)) {
      sessions.set(source, (sessions.get(source) ?? 0) + (Number(count) || 0));
    }
  }

  const orderStats = new Map(
    orders.map((row) => [row.source ?? "direct", { orders: row._count, revenue: toNumber(row._sum.total) }]),
  );

  return TRAFFIC_SOURCES.map((source) => {
    const sessionCount = sessions.get(source) ?? 0;
    const stats = orderStats.get(source) ?? { orders: 0, revenue: 0 };
    return {
      source,
      sessions: sessionCount,
      orders: stats.orders,
      revenue: stats.revenue,
      conversionRate: sessionCount ? round2((stats.orders / sessionCount) * 100) : 0,
    };
  })
    .filter((row) => row.sessions > 0 || row.orders > 0)
    .sort((a, b) => b.sessions - a.sessions);
}

export async function getDeviceBreakdown(storeId: string, range: DateRange) {
  const rows = await prisma.analyticsDaily.findMany({
    where: { storeId, date: { gte: range.from, lt: range.to } },
    select: { deviceBreakdown: true },
  });
  const totals = new Map<string, number>();
  for (const row of rows) {
    const breakdown = (row.deviceBreakdown ?? {}) as Record<string, number>;
    for (const [device, count] of Object.entries(breakdown)) {
      totals.set(device, (totals.get(device) ?? 0) + (Number(count) || 0));
    }
  }
  return [...totals.entries()]
    .map(([device, sessions]) => ({ device, sessions }))
    .sort((a, b) => b.sessions - a.sessions);
}

export async function getConversionFunnel(storeId: string, range: DateRange): Promise<FunnelStep[]> {
  const [traffic, orders] = await Promise.all([
    trafficTotals(storeId, range.from, range.to),
    prisma.order.count({ where: { storeId, createdAt: { gte: range.from, lt: range.to } } }),
  ]);

  const raw = [
    { label: "Visitors", value: traffic.visitors },
    { label: "Product views", value: traffic.productViews },
    { label: "Added to cart", value: traffic.addToCarts },
    { label: "Checkout started", value: traffic.checkoutsStarted },
    { label: "Purchased", value: orders },
  ];
  const top = raw[0].value || 1;

  return raw.map((step, index) => ({
    ...step,
    rateFromPrevious: index === 0 ? null : raw[index - 1].value ? round2((step.value / raw[index - 1].value) * 100) : 0,
    rateFromTop: round2((step.value / top) * 100),
  }));
}

export async function getSalesByCollection(storeId: string, range: DateRange) {
  const collections = await prisma.collection.findMany({
    where: { storeId },
    select: { id: true, title: true, products: { select: { productId: true } } },
  });

  const items = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, order: { storeId, createdAt: { gte: range.from, lt: range.to } } },
    _sum: { total: true, quantity: true },
  });
  const revenueByProduct = new Map(
    items.map((row) => [row.productId!, { revenue: toNumber(row._sum.total), units: row._sum.quantity ?? 0 }]),
  );

  return collections
    .map((collection) => {
      let revenue = 0;
      let units = 0;
      for (const link of collection.products) {
        const stats = revenueByProduct.get(link.productId);
        if (!stats) continue;
        revenue += stats.revenue;
        units += stats.units;
      }
      return { id: collection.id, title: collection.title, revenue: round2(revenue), units };
    })
    .filter((row) => row.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

/** True when any row in the requested window is seeded demo data. */
export async function rangeContainsDemoData(storeId: string, range: DateRange) {
  const demoOrder = await prisma.order.findFirst({
    where: { storeId, isDemo: true, createdAt: { gte: range.from, lt: range.to } },
    select: { id: true },
  });
  return Boolean(demoOrder);
}
