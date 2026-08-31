import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/session";
import { serviceContext, NotFoundError } from "@/lib/services/context";
import { getCustomer } from "@/lib/services/customers";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { formatMoney, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DemoTag, EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EditCustomerButton } from "@/components/admin/customer-dialogs";
import { FULFILLMENT_TONE, PAYMENT_TONE, humanize } from "@/lib/status";

export const metadata: Metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("customers:read");
  const ctx = await serviceContext();
  const { id } = await params;

  let customer;
  try {
    customer = await getCustomer(ctx, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const store = await prisma.store.findUniqueOrThrow({
    where: { id: ctx.storeId },
    select: { currency: true },
  });
  const currency = store.currency;
  const canWrite = can(auth.role, "customers:write");

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        breadcrumb={
          <Link href="/admin/customers" className="inline-flex items-center gap-1 hover:text-ink-800">
            <ArrowLeft className="size-3" />
            Customers
          </Link>
        }
        title={
          <span className="flex items-center gap-2">
            {customer.firstName} {customer.lastName}
            {customer.isDemo && <DemoTag label="Demo" />}
          </span>
        }
        description={customer.email}
        actions={
          canWrite && (
            <EditCustomerButton
              customerId={customer.id}
              initial={{
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone ?? "",
                notes: customer.notes ?? "",
                tags: customer.tags,
                acceptsMarketing: customer.acceptsMarketing,
              }}
            />
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Lifetime value" value={formatMoney(customer.stats.totalSpent, currency)} />
        <Stat label="Orders" value={String(customer.stats.orderCount)} />
        <Stat label="Average order" value={formatMoney(customer.stats.averageOrderValue, currency)} />
        <Stat
          label="Customer since"
          value={formatDate(customer.createdAt)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader><CardTitle>Order history</CardTitle></CardHeader>
            {customer.orders.length === 0 ? (
              <EmptyState title="No orders yet" description="This customer has not placed an order." />
            ) : (
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH>Order</TH>
                      <TH>Date</TH>
                      <TH>Payment</TH>
                      <TH>Fulfillment</TH>
                      <TH align="right">Items</TH>
                      <TH align="right">Total</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {customer.orders.map((order) => (
                      <TR key={order.id}>
                        <TD>
                          <Link href={`/admin/orders/${order.id}`} className="font-medium text-ink-900 hover:underline">
                            #{order.number}
                          </Link>
                        </TD>
                        <TD className="whitespace-nowrap text-ink-500">{formatDate(order.createdAt)}</TD>
                        <TD><Badge tone={PAYMENT_TONE[order.paymentStatus]}>{humanize(order.paymentStatus)}</Badge></TD>
                        <TD><Badge tone={FULFILLMENT_TONE[order.fulfillmentStatus]}>{humanize(order.fulfillmentStatus)}</Badge></TD>
                        <TD align="right" className="tabular">{order._count.items}</TD>
                        <TD align="right" className="tabular font-medium text-ink-900">
                          {formatMoney(toNumber(order.total), currency)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            )}
          </Card>

          {customer.reviews.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Reviews left</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {customer.reviews.map((review) => (
                  <div key={review.id} className="border-b border-ink-200 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[var(--color-signal-warning)]">
                        {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                      </span>
                      <Link href={`/admin/products/${review.product.id}`} className="text-[12.5px] text-pine-700 hover:underline">
                        {review.product.title}
                      </Link>
                    </div>
                    {review.title && <p className="mt-1 text-[13px] font-medium text-ink-800">{review.title}</p>}
                    <p className="mt-0.5 text-[12.5px] text-ink-600">{review.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <p className="break-all text-ink-700">{customer.email}</p>
              {customer.phone && <p className="text-ink-700">{customer.phone}</p>}
              <div className="flex flex-wrap gap-1 pt-1">
                {customer.tags.map((tag) => <Badge key={tag} tone="outline">{tag}</Badge>)}
                <Badge tone={customer.acceptsMarketing ? "success" : "neutral"}>
                  {customer.acceptsMarketing ? "Subscribed" : "Not subscribed"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Addresses</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-[13px] leading-relaxed text-ink-700">
              {customer.addresses.length === 0 ? (
                <p className="text-ink-400">No saved addresses.</p>
              ) : (
                customer.addresses.map((address) => (
                  <address key={address.id} className="not-italic">
                    {address.isDefault && <Badge tone="outline" className="mb-1">Default</Badge>}
                    <br />
                    {address.line1}<br />
                    {address.line2 && <>{address.line2}<br /></>}
                    {address.city}, {address.region} {address.postalCode}<br />
                    {address.country}
                  </address>
                ))
              )}
            </CardContent>
          </Card>

          {customer.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-[13px] text-ink-700">{customer.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
      <p className="text-[12px] text-ink-500">{label}</p>
      <p className="tabular mt-0.5 text-[18px] font-semibold text-ink-900">{value}</p>
    </div>
  );
}
