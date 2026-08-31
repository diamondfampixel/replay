import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/session";
import { serviceContext, NotFoundError } from "@/lib/services/context";
import { getOrder } from "@/lib/services/orders";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { toNumber, formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DemoTag } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";
import { OrderActions } from "@/components/admin/order-actions";
import { FULFILLMENT_TONE, PAYMENT_TONE, humanize } from "@/lib/status";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

type AddressShape = {
  name?: string; line1?: string; line2?: string | null;
  city?: string; region?: string; postalCode?: string; country?: string;
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("orders:read");
  const ctx = await serviceContext();
  const { id } = await params;

  let order;
  try {
    order = await getOrder(ctx, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const store = await prisma.store.findUniqueOrThrow({
    where: { id: ctx.storeId },
    select: { currency: true },
  });
  const currency = store.currency;
  const shipping = (order.shippingAddress ?? {}) as AddressShape;
  const billing = (order.billingAddress ?? shipping) as AddressShape;
  const total = toNumber(order.total);
  const refunded = toNumber(order.refundedTotal);

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        breadcrumb={
          <Link href="/admin/orders" className="inline-flex items-center gap-1 hover:text-ink-800">
            <ArrowLeft className="size-3" />
            Orders
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            Order #{order.number}
            <Badge tone={PAYMENT_TONE[order.paymentStatus]}>{humanize(order.paymentStatus)}</Badge>
            <Badge tone={FULFILLMENT_TONE[order.fulfillmentStatus]}>{humanize(order.fulfillmentStatus)}</Badge>
            {order.isDemo && <DemoTag label="Demo order" />}
          </span>
        }
        description={`Placed ${formatDate(order.createdAt, "datetime")}${order.source ? ` · via ${order.source}` : ""}`}
        actions={
          <OrderActions
            orderId={order.id}
            fulfillmentStatus={order.fulfillmentStatus}
            paymentStatus={order.paymentStatus}
            total={total}
            refunded={refunded}
            currency={currency}
            note={order.notes}
            canWrite={can(auth.role, "orders:write")}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <span className="text-[12.5px] text-ink-500">
                {order.items.reduce((sum, item) => sum + item.quantity, 0)} units
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-ink-200">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl ?? "/placeholder.svg"}
                      alt=""
                      className="size-11 shrink-0 rounded border border-ink-200 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      {item.productId ? (
                        <Link href={`/admin/products/${item.productId}`} className="text-[13px] font-medium text-ink-900 hover:underline">
                          {item.title}
                        </Link>
                      ) : (
                        <span className="text-[13px] font-medium text-ink-900">{item.title}</span>
                      )}
                      <p className="text-[11.5px] text-ink-500">
                        {item.variantTitle && `${item.variantTitle} · `}
                        {item.sku ?? "No SKU"}
                      </p>
                    </div>
                    <span className="tabular text-[12.5px] text-ink-500">
                      {formatMoney(toNumber(item.unitPrice), currency)} × {item.quantity}
                    </span>
                    <span className="tabular w-20 text-right text-[13px] font-medium text-ink-900">
                      {formatMoney(toNumber(item.total), currency)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="space-y-1.5 border-t border-ink-200 px-4 py-3 text-[13px]">
                <Line label="Subtotal" value={formatMoney(toNumber(order.subtotal), currency)} />
                {toNumber(order.discountTotal) > 0 && (
                  <Line
                    label={`Discount${order.discountCode ? ` (${order.discountCode})` : ""}`}
                    value={`−${formatMoney(toNumber(order.discountTotal), currency)}`}
                  />
                )}
                <Line label="Shipping" value={formatMoney(toNumber(order.shippingTotal), currency)} />
                <Line label="Tax" value={formatMoney(toNumber(order.taxTotal), currency)} />
                <div className="flex justify-between border-t border-ink-200 pt-1.5 text-[14px] font-semibold text-ink-900">
                  <dt>Total</dt>
                  <dd className="tabular">{formatMoney(total, currency)}</dd>
                </div>
                {refunded > 0 && (
                  <>
                    <Line label="Refunded" value={`−${formatMoney(refunded, currency)}`} />
                    <div className="flex justify-between text-[13px] font-medium text-ink-900">
                      <dt>Net</dt>
                      <dd className="tabular">{formatMoney(total - refunded, currency)}</dd>
                    </div>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-ink-200 pl-4">
                {order.events.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[21px] top-1 size-2 rounded-full border-2 border-white bg-ink-300" />
                    <p className="text-[13px] text-ink-800">{event.message}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-400">
                      {formatDate(event.createdAt, "datetime")}
                      {event.actor === "ai" && " · AI assistant"}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader><CardTitle>Internal note</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-[13px] text-ink-700">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              {order.customer ? (
                <Link href={`/admin/customers/${order.customer.id}`} className="font-medium text-pine-700 hover:underline">
                  {order.customer.firstName} {order.customer.lastName}
                </Link>
              ) : (
                <p className="text-ink-700">Guest checkout</p>
              )}
              <p className="break-all text-ink-600">{order.email}</p>
              {order.customer?.phone && <p className="text-ink-600">{order.customer.phone}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Shipping address</CardTitle></CardHeader>
            <CardContent className="text-[13px] leading-relaxed text-ink-700">
              <AddressBlock address={shipping} />
              {order.trackingNumber && (
                <p className="mt-2 border-t border-ink-200 pt-2 text-[12.5px] text-ink-500">
                  {order.trackingCarrier} · <span className="font-mono">{order.trackingNumber}</span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Billing address</CardTitle></CardHeader>
            <CardContent className="text-[13px] leading-relaxed text-ink-700">
              <AddressBlock address={billing} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              {order.payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-2">
                  <span className="text-ink-600">
                    {payment.provider === "stripe" ? "Stripe" : "Simulated"} · {humanize(payment.status)}
                  </span>
                  <span className="tabular font-medium text-ink-900">
                    {formatMoney(toNumber(payment.amount), currency)}
                  </span>
                </div>
              ))}
              {order.payments.some((p) => p.provider === "simulated") && (
                <p className="border-t border-ink-200 pt-2 text-[11.5px] text-ink-400">
                  Simulated payments are recorded internally. Connect Stripe to process real charges.
                </p>
              )}
            </CardContent>
          </Card>

          {(order.utmSource || order.source) && (
            <Card>
              <CardHeader><CardTitle>Attribution</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-[13px]">
                <Line label="Source" value={order.source ?? "—"} />
                {order.utmSource && <Line label="UTM source" value={order.utmSource} />}
                {order.utmMedium && <Line label="UTM medium" value={order.utmMedium} />}
                {order.utmCampaign && <Line label="Campaign" value={order.utmCampaign} />}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="tabular capitalize text-ink-800">{value}</dd>
    </div>
  );
}

function AddressBlock({ address }: { address: AddressShape }) {
  if (!address?.line1) return <p className="text-ink-400">No address recorded.</p>;
  return (
    <address className="not-italic">
      {address.name && <>{address.name}<br /></>}
      {address.line1}<br />
      {address.line2 && <>{address.line2}<br /></>}
      {address.city}, {address.region} {address.postalCode}<br />
      {address.country}
    </address>
  );
}
