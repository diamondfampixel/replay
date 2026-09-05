import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { getActiveContext } from "@/lib/session";
import { getStore } from "@/lib/storefront/data";
import { formatMoney, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Order confirmation" };

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string; id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { storeSlug, id } = await params;
  const { key } = await searchParams;
  const store = await getStore(storeSlug);

  const order = await prisma.order.findFirst({
    where: { id, storeId: store.id },
    include: { items: true },
  });
  if (!order) notFound();

  // The page shows the buyer's address and email, so an order id alone is not
  // enough: the shopper's checkout key must match, or the viewer must be
  // signed-in staff of this store.
  const staff = await getActiveContext();
  const isStaff = staff?.storeId === store.id;
  const keyMatches = Boolean(order.accessToken && key && timingSafeEqual(Buffer.from(order.accessToken), Buffer.from(key.padEnd(order.accessToken.length).slice(0, order.accessToken.length))) && key === order.accessToken);
  if (!isStaff && !keyMatches) notFound();

  const address = (order.shippingAddress ?? {}) as {
    name?: string; line1?: string; line2?: string | null;
    city?: string; region?: string; postalCode?: string; country?: string;
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <div className="flex items-center gap-2.5">
        <CheckCircle2 className="size-6" style={{ color: "var(--store-primary)" }} />
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink-900">
          Thank you — order #{order.number} is confirmed
        </h1>
      </div>
      <p className="mt-2 text-[14.5px] text-ink-600">
        A confirmation has been recorded for {order.email}. Placed {formatDate(order.createdAt, "datetime")}.
      </p>

      <div className="mt-4 rounded-md border border-ink-200 bg-ink-50 px-4 py-3 text-[13px] text-ink-600">
        This order was placed through the development checkout, so no payment was processed and no
        confirmation email was sent.
      </div>

      <div className="mt-8 rounded-lg border border-ink-200">
        <ul className="divide-y divide-ink-200">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl ?? "/placeholder.svg"} alt="" className="size-14 shrink-0 rounded border border-ink-200 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink-900">{item.title}</p>
                {item.variantTitle && <p className="text-[12.5px] text-ink-500">{item.variantTitle}</p>}
                <p className="tabular text-[12.5px] text-ink-500">Qty {item.quantity}</p>
              </div>
              <span className="tabular text-[14px] text-ink-900">
                {formatMoney(toNumber(item.total), order.currency)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-ink-200 px-4 py-4 text-[13.5px]">
          <Row label="Subtotal" value={formatMoney(toNumber(order.subtotal), order.currency)} />
          {toNumber(order.discountTotal) > 0 && (
            <Row
              label={`Discount${order.discountCode ? ` (${order.discountCode})` : ""}`}
              value={`−${formatMoney(toNumber(order.discountTotal), order.currency)}`}
            />
          )}
          <Row label="Shipping" value={formatMoney(toNumber(order.shippingTotal), order.currency)} />
          <Row label="Tax" value={formatMoney(toNumber(order.taxTotal), order.currency)} />
          <div className="flex justify-between border-t border-ink-200 pt-2.5 text-[16px] font-semibold text-ink-900">
            <dt>Total</dt>
            <dd className="tabular">{formatMoney(toNumber(order.total), order.currency)}</dd>
          </div>
        </dl>
      </div>

      {address.line1 && (
        <div className="mt-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-400">Shipping to</h2>
          <address className="mt-2 text-[14px] not-italic leading-relaxed text-ink-700">
            {address.name}<br />
            {address.line1}<br />
            {address.line2 && <>{address.line2}<br /></>}
            {address.city}, {address.region} {address.postalCode}<br />
            {address.country}
          </address>
        </div>
      )}

      <Link
        href={`/s/${storeSlug}/shop`}
        className="mt-8 inline-flex h-11 items-center rounded-md border border-ink-300 px-5 text-[14px] font-medium text-ink-800 hover:bg-ink-50"
      >
        Continue shopping
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-600">{label}</dt>
      <dd className="tabular text-ink-900">{value}</dd>
    </div>
  );
}
