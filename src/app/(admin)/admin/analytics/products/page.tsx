import Link from "next/link";
import { requireCapability } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getTopProducts, resolveRange } from "@/lib/services/analytics";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { formatMoney, formatNumber } from "@/lib/money";

export default async function ProductAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireCapability("analytics:read");
  const params = await searchParams;
  const range = resolveRange(params.range, params.from, params.to);

  const [top, store, views] = await Promise.all([
    getTopProducts(ctx.storeId, range, 50),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
    prisma.analyticsEvent.groupBy({
      by: ["productId"],
      where: {
        storeId: ctx.storeId,
        type: "product_view",
        productId: { not: null },
        createdAt: { gte: range.from, lt: range.to },
      },
      _count: true,
    }),
  ]);

  const viewsByProduct = new Map(views.map((row) => [row.productId!, row._count]));
  const totalRevenue = top.reduce((sum, product) => sum + product.revenue, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Sales by product</CardTitle>
        <span className="tabular text-[12.5px] text-ink-500">
          {formatMoney(totalRevenue, store.currency)} across {top.length} products
        </span>
      </CardHeader>
      {top.length === 0 ? (
        <EmptyState title="No product sales in this period" />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Product</TH>
                <TH align="right">Units</TH>
                <TH align="right">Orders</TH>
                <TH align="right">Views</TH>
                <TH align="right">View → purchase</TH>
                <TH align="right">Revenue</TH>
                <TH align="right">Share</TH>
              </tr>
            </THead>
            <TBody>
              {top.map((product) => {
                const productViews = viewsByProduct.get(product.id) ?? 0;
                return (
                  <TR key={product.id}>
                    <TD>
                      <Link href={`/admin/products/${product.id}`} className="flex items-center gap-2.5 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.imageUrl ?? "/placeholder.svg"} alt="" className="size-8 rounded border border-ink-200 object-cover" />
                        <span className="font-medium text-ink-900 group-hover:underline">{product.title}</span>
                      </Link>
                    </TD>
                    <TD align="right" className="tabular">{formatNumber(product.units)}</TD>
                    <TD align="right" className="tabular">{formatNumber(product.orders)}</TD>
                    <TD align="right" className="tabular">{productViews ? formatNumber(productViews) : "—"}</TD>
                    <TD align="right" className="tabular">
                      {productViews ? `${((product.orders / productViews) * 100).toFixed(1)}%` : "—"}
                    </TD>
                    <TD align="right" className="tabular font-medium text-ink-900">
                      {formatMoney(product.revenue, store.currency)}
                    </TD>
                    <TD align="right" className="tabular text-ink-500">
                      {totalRevenue ? `${((product.revenue / totalRevenue) * 100).toFixed(1)}%` : "—"}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      )}
      {views.length === 0 && (
        <p className="border-t border-ink-200 px-4 py-2.5 text-[12px] text-ink-400">
          Product view counts come from storefront events. Seeded history only carries a sample of
          raw events, so views may be sparse for older periods.
        </p>
      )}
    </Card>
  );
}
