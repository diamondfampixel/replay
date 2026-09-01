import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiContext } from "@/lib/services/context";
import { can } from "@/lib/permissions";

export const runtime = "nodejs";

function csv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
}

/**
 * Data portability: a merchant can take their orders, customers and catalog
 * out as CSV on any plan. Portability is not a paid feature.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const ctx = await apiContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(ctx.role, "settings:read")) {
    return NextResponse.json({ error: "Your role cannot export data." }, { status: 403 });
  }

  const { kind } = await params;
  const storeId = ctx.storeId;
  let rows: Array<Record<string, unknown>>;

  if (kind === "orders") {
    const orders = await prisma.order.findMany({
      where: { storeId },
      orderBy: { number: "asc" },
      include: { items: true },
    });
    rows = orders.map((order) => ({
      number: order.number,
      createdAt: order.createdAt.toISOString(),
      email: order.email,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      total: order.total,
      currency: order.currency,
      discountCode: order.discountCode,
      items: order.items.map((item) => `${item.quantity}x ${item.title}${item.variantTitle ? ` (${item.variantTitle})` : ""}`).join("; "),
      isDemo: order.isDemo,
    }));
  } else if (kind === "customers") {
    const customers = await prisma.customer.findMany({ where: { storeId }, orderBy: { createdAt: "asc" } });
    rows = customers.map((customer) => ({
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      createdAt: customer.createdAt.toISOString(),
      acceptsMarketing: customer.acceptsMarketing,
      isDemo: customer.isDemo,
    }));
  } else if (kind === "products") {
    const products = await prisma.product.findMany({
      where: { storeId },
      orderBy: { createdAt: "asc" },
      include: { variants: true },
    });
    rows = products.map((product) => ({
      title: product.title,
      slug: product.slug,
      status: product.status,
      price: product.price,
      inventory: product.inventory,
      vendor: product.vendor,
      tags: product.tags.join("; "),
      variants: product.variants.map((v) => `${v.title} @ ${v.price ?? product.price} (${v.inventory} in stock)`).join("; "),
      isDemo: product.isDemo,
    }));
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }

  return new NextResponse(csv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="halyard-${kind}.csv"`,
    },
  });
}
