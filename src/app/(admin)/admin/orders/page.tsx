import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { listOrders } from "@/lib/services/orders";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DemoTag, EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataToolbar, Pagination } from "@/components/admin/data-toolbar";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { FULFILLMENT_TONE, PAYMENT_TONE, humanize } from "@/lib/status";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireCapability("orders:read");
  const ctx = await serviceContext();
  const params = await searchParams;

  const [result, store] = await Promise.all([
    listOrders(ctx, {
      q: params.q,
      paymentStatus: params.paymentStatus,
      fulfillmentStatus: params.fulfillmentStatus,
      customerId: params.customerId,
      sort: params.sort ?? "newest",
      page: params.page ? Number(params.page) : 1,
    }),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
  ]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Orders"
        description={`${result.total} order${result.total === 1 ? "" : "s"}`}
      />

      <Card className="overflow-hidden">
        <DataToolbar
          searchPlaceholder="Search order number, email or discount code…"
          filters={[
            {
              key: "paymentStatus",
              label: "Payment",
              options: [
                { value: "PAID", label: "Paid" },
                { value: "PENDING", label: "Pending" },
                { value: "REFUNDED", label: "Refunded" },
                { value: "PARTIALLY_REFUNDED", label: "Partially refunded" },
                { value: "FAILED", label: "Failed" },
              ],
            },
            {
              key: "fulfillmentStatus",
              label: "Fulfillment",
              options: [
                { value: "UNFULFILLED", label: "Unfulfilled" },
                { value: "PARTIALLY_FULFILLED", label: "Partially fulfilled" },
                { value: "FULFILLED", label: "Fulfilled" },
                { value: "CANCELLED", label: "Cancelled" },
              ],
            },
          ]}
          sortOptions={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "total_desc", label: "Highest total" },
            { value: "total_asc", label: "Lowest total" },
          ]}
        />

        {result.rows.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders match"
            description="Orders placed on your storefront appear here immediately."
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Order</TH>
                  <TH>Customer</TH>
                  <TH>Date</TH>
                  <TH>Payment</TH>
                  <TH>Fulfillment</TH>
                  <TH align="right">Items</TH>
                  <TH align="right">Total</TH>
                </tr>
              </THead>
              <TBody>
                {result.rows.map((order) => (
                  <TR key={order.id}>
                    <TD>
                      <Link href={`/admin/orders/${order.id}`} className="flex items-center gap-1.5 font-medium text-ink-900 hover:underline">
                        #{order.number}
                        {order.isDemo && <DemoTag label="Demo" />}
                      </Link>
                    </TD>
                    <TD>
                      {order.customer ? (
                        <Link href={`/admin/customers/${order.customer.id}`} className="hover:underline">
                          {order.customer.firstName} {order.customer.lastName}
                        </Link>
                      ) : (
                        <span className="text-ink-500">{order.email}</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-ink-500">{formatDate(order.createdAt, "datetime")}</TD>
                    <TD>
                      <Badge tone={PAYMENT_TONE[order.paymentStatus]}>{humanize(order.paymentStatus)}</Badge>
                    </TD>
                    <TD>
                      <Badge tone={FULFILLMENT_TONE[order.fulfillmentStatus]}>{humanize(order.fulfillmentStatus)}</Badge>
                    </TD>
                    <TD align="right" className="tabular">{order.itemCount}</TD>
                    <TD align="right" className="tabular font-medium text-ink-900">
                      {formatMoney(order.total, store.currency)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}

        {result.total > 0 && (
          <Pagination page={result.page} pageCount={result.pageCount} total={result.total} perPage={result.perPage} />
        )}
      </Card>
    </div>
  );
}
