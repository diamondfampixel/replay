import "server-only";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/money";

export type SearchHit = {
  id: string;
  type: "product" | "order" | "customer" | "collection" | "page" | "discount" | "experiment";
  title: string;
  subtitle?: string;
  href: string;
};

/**
 * Cross-entity search used by the command bar, the admin global search and the
 * AI `search_business_data` tool. Always scoped to a single store.
 */
export async function searchBusinessData(
  storeId: string,
  query: string,
  limitPerType = 5,
): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const contains = { contains: q, mode: "insensitive" as const };
  const orderNumber = Number.parseInt(q.replace(/^#/, ""), 10);

  const [products, orders, customers, collections, pages, discounts, experiments] =
    await Promise.all([
      prisma.product.findMany({
        where: { storeId, OR: [{ title: contains }, { sku: contains }, { tags: { has: q.toLowerCase() } }] },
        take: limitPerType,
        select: { id: true, title: true, price: true, status: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.order.findMany({
        where: {
          storeId,
          OR: [
            { email: contains },
            ...(Number.isFinite(orderNumber) ? [{ number: orderNumber }] : []),
          ],
        },
        take: limitPerType,
        select: { id: true, number: true, email: true, total: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.customer.findMany({
        where: {
          storeId,
          OR: [{ email: contains }, { firstName: contains }, { lastName: contains }],
        },
        take: limitPerType,
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      prisma.collection.findMany({
        where: { storeId, title: contains },
        take: limitPerType,
        select: { id: true, title: true, slug: true },
      }),
      prisma.page.findMany({
        where: { storeId, OR: [{ title: contains }, { slug: contains }] },
        take: limitPerType,
        select: { id: true, title: true, slug: true, type: true },
      }),
      prisma.discount.findMany({
        where: { storeId, OR: [{ title: contains }, { code: contains }] },
        take: limitPerType,
        select: { id: true, title: true, code: true, status: true },
      }),
      prisma.experiment.findMany({
        where: { storeId, name: contains },
        take: limitPerType,
        select: { id: true, name: true, status: true },
      }),
    ]);

  return [
    ...products.map((p): SearchHit => ({
      id: p.id, type: "product", title: p.title,
      subtitle: `$${toNumber(p.price).toFixed(2)} · ${p.status.toLowerCase()}`,
      href: `/admin/products/${p.id}`,
    })),
    ...orders.map((o): SearchHit => ({
      id: o.id, type: "order", title: `Order #${o.number}`,
      subtitle: `${o.email} · $${toNumber(o.total).toFixed(2)}`,
      href: `/admin/orders/${o.id}`,
    })),
    ...customers.map((c): SearchHit => ({
      id: c.id, type: "customer", title: `${c.firstName} ${c.lastName}`,
      subtitle: c.email, href: `/admin/customers/${c.id}`,
    })),
    ...collections.map((c): SearchHit => ({
      id: c.id, type: "collection", title: c.title,
      subtitle: `/collections/${c.slug}`, href: `/admin/collections/${c.id}`,
    })),
    ...pages.map((p): SearchHit => ({
      id: p.id, type: "page", title: p.title,
      subtitle: p.type === "HOME" ? "Homepage" : `/pages/${p.slug}`,
      href: p.type === "HOME" ? "/admin/store/editor" : `/admin/content/${p.id}`,
    })),
    ...discounts.map((d): SearchHit => ({
      id: d.id, type: "discount", title: d.title,
      subtitle: `${d.code ?? "Automatic"} · ${d.status.toLowerCase()}`,
      href: `/admin/discounts/${d.id}`,
    })),
    ...experiments.map((e): SearchHit => ({
      id: e.id, type: "experiment", title: e.name,
      subtitle: e.status.toLowerCase(), href: `/admin/experiments/${e.id}`,
    })),
  ];
}
