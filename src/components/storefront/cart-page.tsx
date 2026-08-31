"use client";

import * as React from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/storefront/cart-provider";
import { formatMoney } from "@/lib/money";

export function CartPageClient({ storeSlug }: { storeSlug: string }) {
  const { cart, update, remove, applyDiscount, pending } = useCart();
  const base = `/s/${storeSlug}`;
  const [code, setCode] = React.useState(cart.discount?.code ?? "");
  const [codeError, setCodeError] = React.useState<string | null>(cart.discountError);
  const [applying, setApplying] = React.useState(false);

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <ShoppingBag className="mx-auto size-9 text-ink-300" />
        <h1 className="mt-4 text-[22px] font-semibold text-ink-900">Your cart is empty</h1>
        <p className="mt-1.5 text-[14px] text-ink-500">Add something you like and it will appear here.</p>
        <Link
          href={`${base}/shop`}
          className="mt-6 inline-flex h-11 items-center rounded-md bg-ink-900 px-6 text-[14px] font-medium text-white hover:bg-ink-800"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink-900">Your cart</h1>

      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_340px]">
        <ul className="divide-y divide-ink-200 border-y border-ink-200">
          {cart.items.map((item) => (
            <li key={item.id} className="flex gap-4 py-5">
              <Link href={`${base}/products/${item.slug}`} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl ?? "/placeholder.svg"} alt="" className="size-24 rounded-md border border-ink-200 object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`${base}/products/${item.slug}`} className="text-[15px] font-medium text-ink-900 hover:underline">
                  {item.title}
                </Link>
                {item.variantTitle && <p className="text-[13px] text-ink-500">{item.variantTitle}</p>}
                <p className="tabular mt-1 text-[13.5px] text-ink-600">
                  {formatMoney(item.unitPrice, cart.currency)} each
                </p>
                {!item.inStock && (
                  <p className="mt-1 text-[12.5px] text-[var(--color-signal-negative)]">
                    Only {item.available} available — reduce the quantity to check out.
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center rounded-md border border-ink-200">
                    <button
                      type="button"
                      onClick={() => update(item.id, item.quantity - 1)}
                      disabled={pending}
                      className="px-2.5 py-1.5 text-ink-500 hover:text-ink-900 disabled:opacity-50"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="tabular w-8 text-center text-[13.5px]">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => update(item.id, item.quantity + 1)}
                      disabled={pending || item.quantity >= item.available}
                      className="px-2.5 py-1.5 text-ink-500 hover:text-ink-900 disabled:opacity-50"
                      aria-label="Increase quantity"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 text-[13px] text-ink-400 hover:text-[var(--color-signal-negative)]"
                  >
                    <X className="size-3" />
                    Remove
                  </button>
                </div>
              </div>
              <span className="tabular shrink-0 text-[15px] font-medium text-ink-900">
                {formatMoney(item.lineTotal, cart.currency)}
              </span>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-lg border border-ink-200 p-5">
          <h2 className="text-[15px] font-semibold text-ink-900">Order summary</h2>

          <form
            className="mt-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setApplying(true);
              const error = await applyDiscount(code.trim() || null);
              setApplying(false);
              setCodeError(error);
            }}
          >
            <label htmlFor="discount" className="mb-1.5 block text-[12.5px] font-medium text-ink-700">
              Discount code
            </label>
            <div className="flex gap-2">
              <input
                id="discount"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="Enter code"
                className="h-9 flex-1 rounded-md border border-ink-200 px-2.5 font-mono text-[13px] uppercase outline-none focus:border-ink-400"
              />
              <button
                type="submit"
                disabled={applying}
                className="h-9 rounded-md border border-ink-300 px-3 text-[13px] font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
              >
                {applying ? "…" : "Apply"}
              </button>
            </div>
            {codeError && <p className="mt-1.5 text-[12.5px] text-[var(--color-signal-negative)]">{codeError}</p>}
            {cart.discount && (
              <p className="mt-1.5 text-[12.5px] text-[var(--color-signal-positive)]">
                {cart.discount.title} applied.
              </p>
            )}
          </form>

          <dl className="mt-5 space-y-2 border-t border-ink-200 pt-4 text-[13.5px]">
            <Row label="Subtotal" value={formatMoney(cart.subtotal, cart.currency)} />
            {cart.automaticDiscounts.map((discount) => (
              <Row
                key={discount.discountId}
                label={discount.title}
                value={discount.freeShipping ? "Free shipping" : `−${formatMoney(discount.amount, cart.currency)}`}
                positive
              />
            ))}
            {cart.discount && !cart.discount.freeShipping && (
              <Row
                label={`Discount (${cart.discount.code})`}
                value={`−${formatMoney(cart.discount.amount, cart.currency)}`}
                positive
              />
            )}
            <Row
              label="Shipping"
              value={cart.shipping === 0 ? "Free" : formatMoney(cart.shipping, cart.currency)}
            />
            {cart.taxEnabled && <Row label="Tax" value={formatMoney(cart.tax, cart.currency)} />}
            <div className="flex justify-between border-t border-ink-200 pt-3 text-[16px] font-semibold text-ink-900">
              <dt>Total</dt>
              <dd className="tabular">{formatMoney(cart.total, cart.currency)}</dd>
            </div>
          </dl>

          {!cart.taxEnabled && (
            <p className="mt-2 text-[11.5px] text-ink-400">
              Tax is not configured for this store, so no tax is added.
            </p>
          )}

          <Link
            href={`${base}/checkout`}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md text-[14.5px] font-medium text-white"
            style={{ background: "var(--store-primary)" }}
          >
            Continue to checkout
          </Link>
          <Link
            href={`${base}/shop`}
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md text-[13.5px] text-ink-600 hover:text-ink-900"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-600">{label}</dt>
      <dd className={positive ? "tabular text-[var(--color-signal-positive)]" : "tabular text-ink-900"}>{value}</dd>
    </div>
  );
}
