import "server-only";
import { prisma, type Prisma } from "@/lib/db";
import { round2 } from "@/lib/money";

export const EVENT_TYPES = [
  "page_view", "product_view", "collection_view", "add_to_cart",
  "remove_from_cart", "checkout_started", "purchase", "email_signup",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type TrackInput = {
  storeId: string;
  type: EventType;
  sessionId: string;
  customerId?: string | null;
  productId?: string | null;
  collectionId?: string | null;
  orderId?: string | null;
  path?: string | null;
  referrer?: string | null;
  source?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  device?: string | null;
  value?: number | null;
  metadata?: Record<string, unknown>;
};

/** Classifies a referrer into the traffic-source buckets the dashboards use. */
export function classifySource(referrer: string | null | undefined, utmSource?: string | null): string {
  const utm = utmSource?.toLowerCase();
  if (utm) {
    if (utm.includes("google")) return "google";
    if (utm.includes("insta")) return "instagram";
    if (utm.includes("tiktok")) return "tiktok";
    if (utm.includes("facebook") || utm.includes("meta") || utm === "fb") return "facebook";
    if (utm.includes("email") || utm.includes("newsletter") || utm.includes("klaviyo")) return "email";
    return "other";
  }
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("google")) return "google";
    if (host.includes("instagram")) return "instagram";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("facebook") || host.includes("fb.")) return "facebook";
    if (host.includes("mail") || host.includes("outlook")) return "email";
    return "other";
  } catch {
    return "other";
  }
}

export function classifyDevice(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? "").toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return "tablet";
  if (/mobi|iphone|android|phone/.test(ua)) return "mobile";
  return "desktop";
}

function utcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Records a storefront event and keeps the daily rollup in step.
 *
 * The rollup is what dashboards read, so incrementing it here is what makes
 * real traffic show up next to the seeded history rather than being invisible
 * until some nightly job runs.
 */
export async function trackEvent(input: TrackInput) {
  const date = utcDay();
  const source = input.source ?? classifySource(input.referrer, input.utmSource);

  await prisma.analyticsEvent.create({
    data: {
      storeId: input.storeId,
      type: input.type,
      sessionId: input.sessionId,
      customerId: input.customerId ?? null,
      productId: input.productId ?? null,
      collectionId: input.collectionId ?? null,
      orderId: input.orderId ?? null,
      path: input.path ?? null,
      referrer: input.referrer ?? null,
      source,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      device: input.device ?? null,
      value: input.value ?? null,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });

  // A session counts once per day toward visitors/sessions.
  const isNewSession =
    input.type === "page_view" &&
    (await prisma.analyticsEvent.count({
      where: { storeId: input.storeId, sessionId: input.sessionId, createdAt: { gte: date } },
    })) === 1;

  const increments: Prisma.AnalyticsDailyUpdateInput = {};
  const creates: Prisma.AnalyticsDailyCreateInput = {
    store: { connect: { id: input.storeId } },
    date,
  };

  function bump(field: keyof Prisma.AnalyticsDailyUpdateInput, amount = 1) {
    (increments as Record<string, unknown>)[field] = { increment: amount };
    (creates as Record<string, unknown>)[field] = amount;
  }

  if (isNewSession) {
    bump("visitors");
    bump("sessions");
  }
  if (input.type === "page_view") bump("pageViews");
  if (input.type === "product_view") {
    bump("productViews");
    bump("pageViews");
  }
  if (input.type === "collection_view") bump("pageViews");
  if (input.type === "add_to_cart") bump("addToCarts");
  if (input.type === "checkout_started") bump("checkoutsStarted");

  const existing = await prisma.analyticsDaily.findUnique({
    where: { storeId_date: { storeId: input.storeId, date } },
  });

  if (existing) {
    const sourceBreakdown = { ...((existing.sourceBreakdown ?? {}) as Record<string, number>) };
    const deviceBreakdown = { ...((existing.deviceBreakdown ?? {}) as Record<string, number>) };
    if (isNewSession) {
      sourceBreakdown[source] = (sourceBreakdown[source] ?? 0) + 1;
      if (input.device) deviceBreakdown[input.device] = (deviceBreakdown[input.device] ?? 0) + 1;
    }
    await prisma.analyticsDaily.update({
      where: { id: existing.id },
      data: {
        ...increments,
        ...(isNewSession ? { sourceBreakdown, deviceBreakdown } : {}),
      },
    });
  } else {
    await prisma.analyticsDaily.create({
      data: {
        ...creates,
        sourceBreakdown: isNewSession ? { [source]: 1 } : {},
        deviceBreakdown: isNewSession && input.device ? { [input.device]: 1 } : {},
      },
    });
  }
}

/**
 * Recomputes a day's rollup from raw events and orders. Used by the analytics
 * "rebuild" action; not run automatically because seeded history intentionally
 * has no backing raw events.
 */
export async function rebuildDailyRollup(storeId: string, date: Date) {
  const day = utcDay(date);
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 1);

  const events = await prisma.analyticsEvent.findMany({
    where: { storeId, createdAt: { gte: day, lt: next } },
    select: { type: true, sessionId: true, source: true, device: true },
  });
  if (!events.length) return null;

  const sessions = new Set(events.map((event) => event.sessionId));
  const sourceBreakdown: Record<string, number> = {};
  const deviceBreakdown: Record<string, number> = {};
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.sessionId)) continue;
    seen.add(event.sessionId);
    if (event.source) sourceBreakdown[event.source] = (sourceBreakdown[event.source] ?? 0) + 1;
    if (event.device) deviceBreakdown[event.device] = (deviceBreakdown[event.device] ?? 0) + 1;
  }

  const count = (type: string) => events.filter((event) => event.type === type).length;

  const orders = await prisma.order.findMany({
    where: { storeId, createdAt: { gte: day, lt: next } },
    select: { subtotal: true, discountTotal: true, refundedTotal: true, items: { select: { quantity: true } } },
  });

  const grossSales = round2(orders.reduce((sum, order) => sum + Number(order.subtotal), 0));
  const discounts = round2(orders.reduce((sum, order) => sum + Number(order.discountTotal), 0));
  const refunds = round2(orders.reduce((sum, order) => sum + Number(order.refundedTotal), 0));

  return prisma.analyticsDaily.upsert({
    where: { storeId_date: { storeId, date: day } },
    create: {
      storeId, date: day,
      visitors: sessions.size, sessions: sessions.size,
      pageViews: count("page_view") + count("product_view") + count("collection_view"),
      productViews: count("product_view"),
      addToCarts: count("add_to_cart"),
      checkoutsStarted: count("checkout_started"),
      orders: orders.length,
      unitsSold: orders.reduce((sum, order) => sum + order.items.reduce((s, i) => s + i.quantity, 0), 0),
      grossSales, discounts, refunds, netSales: round2(grossSales - discounts - refunds),
      sourceBreakdown, deviceBreakdown,
    },
    update: {
      visitors: sessions.size, sessions: sessions.size,
      pageViews: count("page_view") + count("product_view") + count("collection_view"),
      productViews: count("product_view"),
      addToCarts: count("add_to_cart"),
      checkoutsStarted: count("checkout_started"),
      orders: orders.length,
      unitsSold: orders.reduce((sum, order) => sum + order.items.reduce((s, i) => s + i.quantity, 0), 0),
      grossSales, discounts, refunds, netSales: round2(grossSales - discounts - refunds),
      sourceBreakdown, deviceBreakdown,
    },
  });
}
