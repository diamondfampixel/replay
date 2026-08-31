"use client";

import * as React from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/storefront/cart-provider";
import { formatMoney } from "@/lib/money";
import type { StorefrontStore } from "@/lib/storefront/data";

export function CartDrawer({ store }: { store: StorefrontStore }) {
  const { cart, drawerOpen, setDrawerOpen, update, remove, pending } = useCart();
  const base = `/s/${store.slug}`;

  React.useEffect(() => {
    if (!drawerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Shopping cart">
      <div className="absolute inset-0 bg-ink-950/30" onClick={() => setDrawerOpen(false)} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink-900">
            Your cart{cart.itemCount > 0 && ` (${cart.itemCount})`}
          </h2>
          <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close cart" className="rounded p-1 text-ink-500 hover:bg-ink-100">
            <X className="size-4" />
          </button>
        </div>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="size-8 text-ink-300" />
            <p className="text-[14px] text-ink-600">Your cart is empty.</p>
            <Link
              href={`${base}/shop`}
              onClick={() => setDrawerOpen(false)}
              className="mt-1 inline-flex h-10 items-center rounded-md bg-ink-900 px-5 text-[13.5px] font-medium text-white"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <ul className="scroll-thin flex-1 divide-y divide-ink-200 overflow-y-auto px-5">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-3 py-4">
                  <Link href={`${base}/products/${item.slug}`} onClick={() => setDrawerOpen(false)} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imageUrl ?? "/placeholder.svg"} alt="" className="size-16 rounded border border-ink-200 object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`${base}/products/${item.slug}`}
                      onClick={() => setDrawerOpen(false)}
                      className="text-[13.5px] font-medium text-ink-900 hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.variantTitle && <p className="text-[12px] text-ink-500">{item.variantTitle}</p>}
                    {!item.inStock && (
                      <p className="text-[12px] text-[var(--color-signal-negative)]">
                        Only {item.available} left — reduce the quantity
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center rounded-md border border-ink-200">
                        <button
                          type="button"
                          onClick={() => update(item.id, item.quantity - 1)}
                          disabled={pending}
                          className="px-2 py-1 text-ink-500 hover:text-ink-900 disabled:opacity-50"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="tabular w-7 text-center text-[13px]">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => update(item.id, item.quantity + 1)}
                          disabled={pending || item.quantity >= item.available}
                          className="px-2 py-1 text-ink-500 hover:text-ink-900 disabled:opacity-50"
                          aria-label="Increase quantity"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        disabled={pending}
                        className="text-[12px] text-ink-400 hover:text-[var(--color-signal-negative)]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className="tabular shrink-0 text-[13.5px] font-medium text-ink-900">
                    {formatMoney(item.lineTotal, cart.currency)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="border-t border-ink-200 px-5 py-4">
              {cart.discountTotal > 0 && (
                <div className="mb-1.5 flex justify-between text-[13px] text-[var(--color-signal-positive)]">
                  <span>Discount{cart.discount?.code ? ` (${cart.discount.code})` : ""}</span>
                  <span className="tabular">−{formatMoney(cart.discountTotal, cart.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-[14px] font-medium text-ink-900">
                <span>Subtotal</span>
                <span className="tabular">{formatMoney(cart.subtotal - cart.discountTotal, cart.currency)}</span>
              </div>
              <p className="mt-1 text-[12px] text-ink-500">
                {cart.shipping === 0
                  ? "Shipping is free on this order."
                  : `Shipping calculated at checkout${cart.freeShippingThreshold ? ` — free over ${formatMoney(cart.freeShippingThreshold, cart.currency)}` : ""}.`}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`${base}/cart`}
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-ink-300 text-[14px] font-medium text-ink-800 hover:bg-ink-50"
                >
                  View cart
                </Link>
                <Link
                  href={`${base}/checkout`}
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-ink-900 text-[14px] font-medium text-white hover:bg-ink-800"
                >
                  Checkout
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
