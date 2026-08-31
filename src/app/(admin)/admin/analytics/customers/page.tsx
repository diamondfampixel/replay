import Link from "next/link";
import { requireCapability } from "@/lib/session";
import { prisma } from "@/lib/db";
import { resolveRange } from "@/lib/ranges";
import { round2, toNumber, formatMoney, formatNumber } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";

export default async function CustomerAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireCapability("analytics:read");
  const params = await searchParams;
  const range = resolveRange(params.range, params.from, params.to);

  const [store, newCustomers, orders, lifetime] = await Promise.all([
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
    prisma.customer.count({ where: { storeId: ctx.storeId, createdAt: { gte: range.from, lt: range.to } } }),
    prisma.order.findMany({
      where: { storeId: ctx.storeId, createdAt: { gte: range.from, lt: range.to } },
      select: { customerId: true, total: true, refundedTotal: true },
    }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: { storeId: ctx.storeId, customerId: { not: null } },
      _sum: { total: true, refundedTotal: true },
      _count: true,
      orderBy: { _sum: { total: "desc" } },
      take: 20,
    }),
  ]);
  const currency = store.currency;

  const buyerIds = new Set(orders.map((order) => order.customerId).filter(Boolean));
  const ordersByCustomer = new Map<string, number>();
  for (const order of orders) {
    if (!order.customerId) continue;
    ordersByCustomer.set(order.customerId, (ordersByCustomer.get(order.customerId) ?? 0) + 1);
  }
  const repeatBuyers = [...ordersByCustomer.values()].filter((count) => count > 1).length;
  const revenue = round2(orders.reduce((sum, o) => sum + toNumber(o.total) - toNumber(o.refundedTotal), 0));

  const topCustomers = await prisma.customer.findMany({
    where: { id: { in: lifetime.map((row) => row.customerId!).filter(Boolean) } },
    select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
  });
  const customerMap = new Map(topCustomers.map((customer) => [customer.id, customer]));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="New customers" value={formatNumber(newCustomers)} />
        <Stat label="Customers who ordered" value={formatNumber(buyerIds.size)} />
        <Stat label="Repeat buyers" value={formatNumber(repeatBuyers)}
          note={buyerIds.size ? `${((repeatBuyers / buyerIds.size) * 100).toFixed(1)}% of buyers` : undefined} />
        <Stat label="Revenue per buyer" value={buyerIds.size ? formatMoney(revenue / buyerIds.size, currency) : "—"} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Highest lifetime value</CardTitle>
          <span className="text-[12.5px] text-ink-500">All time</span>
        </CardHeader>
        {lifetime.length === 0 ? (
          <EmptyState title="No customer orders yet" />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Customer</TH>
                  <TH>Email</TH>
                  <TH align="right">Orders</TH>
                  <TH align="right">Average order</TH>
                  <TH align="right">Lifetime value</TH>
                  <TH>Since</TH>
                </tr>
              </THead>
              <TBody>
                {lifetime.map((row) => {
                  const customer = customerMap.get(row.customerId!);
                  if (!customer) return null;
                  const value = round2(toNumber(row._sum.total) - toNumber(row._sum.refundedTotal));
                  return (
                    <TR key={row.customerId}>
                      <TD>
                        <Link href={`/admin/customers/${customer.id}`} className="font-medium text-ink-900 hover:underline">
                          {customer.firstName} {customer.lastName}
                        </Link>
                      </TD>
                      <TD className="text-ink-500">{customer.email}</TD>
                      <TD align="right" className="tabular">{row._count}</TD>
                      <TD align="right" className="tabular">{formatMoney(value / row._count, currency)}</TD>
                      <TD align="right" className="tabular font-medium text-ink-900">{formatMoney(value, currency)}</TD>
                      <TD className="whitespace-nowrap text-ink-500">{formatDate(customer.createdAt)}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <CardContent className="px-4 py-3.5">
        <p className="text-[12px] font-medium text-ink-500">{label}</p>
        <p className="tabular mt-1 text-[22px] font-semibold tracking-[-0.01em] text-ink-900">{value}</p>
        {note && <p className="mt-0.5 text-[11.5px] text-ink-400">{note}</p>}
      </CardContent>
    </Card>
  );
}
