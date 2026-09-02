"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/storefront/cart-provider";
import { useStorefrontSession } from "@/components/storefront/analytics";
import { beginCheckoutAction, checkoutAction } from "@/app/actions/storefront";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type Address = {
  name: string; line1: string; line2: string; city: string;
  region: string; postalCode: string; country: string; phone: string;
};

const EMPTY_ADDRESS: Address = {
  name: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "US", phone: "",
};

export function CheckoutForm({
  storeSlug, storeName, checkoutMode, stripeConfigured,
}: {
  storeSlug: string;
  storeName: string;
  checkoutMode: string;
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const { cart } = useCart();
  const sessionId = useStorefrontSession();
  const base = `/s/${storeSlug}`;

  const [email, setEmail] = React.useState("");
  const [shipping, setShipping] = React.useState<Address>(EMPTY_ADDRESS);
  const [billingSame, setBillingSame] = React.useState(true);
  const [billing, setBilling] = React.useState<Address>(EMPTY_ADDRESS);
  const [acceptsMarketing, setAcceptsMarketing] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current || !sessionId) return;
    started.current = true;
    beginCheckoutAction(storeSlug, sessionId);
  }, [sessionId, storeSlug]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await checkoutAction(
        storeSlug,
        {
          email,
          shippingAddress: { ...shipping, line2: shipping.line2 || null, phone: shipping.phone || null },
          billingSameAsShipping: billingSame,
          billingAddress: billingSame ? null : { ...billing, line2: billing.line2 || null, phone: billing.phone || null },
          acceptsMarketing,
          note: note || null,
        },
        sessionId,
      );

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      router.push(`${base}/orders/${result.data.orderId}`);
    });
  }

  const simulated = checkoutMode !== "stripe";

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink-900">Checkout</h1>

      <div
        className={cn(
          "mt-4 rounded-md border px-4 py-3 text-[13px]",
          simulated ? "border-ink-200 bg-ink-50 text-ink-600" : "border-[#f0dfb8] bg-[#fdf6e7] text-[#7a4e07]",
        )}
      >
        {simulated ? (
          <>
            <span className="font-medium text-ink-900">Development checkout.</span> No payment is
            taken and no card details are collected. Submitting creates a real order record in this
            store so the rest of the platform can be exercised end to end.
            {!stripeConfigured && " Add a Stripe key in Integrations to enable live payments later."}
          </>
        ) : (
          <>
            <span className="font-medium">Stripe checkout is selected but not implemented in this build.</span>{" "}
            Switch back to simulated mode in Settings → Payments to place test orders.
          </>
        )}
      </div>

      <form onSubmit={submit} className="mt-7 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-7">
          <section>
            <h2 className="mb-3 text-[15px] font-semibold text-ink-900">Contact</h2>
            <Field label="Email" error={errors.email} required>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="h-11 w-full rounded-md border border-ink-200 px-3 text-[14px] outline-none focus:border-ink-400"
              />
            </Field>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13.5px] text-ink-600">
              <input
                type="checkbox"
                checked={acceptsMarketing}
                onChange={(event) => setAcceptsMarketing(event.target.checked)}
                className="size-3.5 accent-[var(--store-primary)]"
              />
              Email me about new products and offers from {storeName}
            </label>
          </section>

          <section>
            <h2 className="mb-3 text-[15px] font-semibold text-ink-900">Shipping address</h2>
            <AddressFields value={shipping} onChange={setShipping} errors={errors} prefix="shippingAddress" />
          </section>

          <section>
            <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink-700">
              <input
                type="checkbox"
                checked={billingSame}
                onChange={(event) => setBillingSame(event.target.checked)}
                className="size-3.5 accent-[var(--store-primary)]"
              />
              Billing address is the same as shipping
            </label>
            {!billingSame && (
              <div className="mt-4">
                <h2 className="mb-3 text-[15px] font-semibold text-ink-900">Billing address</h2>
                <AddressFields value={billing} onChange={setBilling} errors={errors} prefix="billingAddress" />
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-[15px] font-semibold text-ink-900">Order note</h2>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Anything we should know? (optional)"
              className="w-full rounded-md border border-ink-200 px-3 py-2 text-[14px] outline-none focus:border-ink-400"
            />
          </section>
        </div>

        <aside className="h-fit rounded-lg border border-ink-200 p-5">
          <h2 className="text-[15px] font-semibold text-ink-900">Your order</h2>
          <ul className="mt-4 space-y-3 border-b border-ink-200 pb-4">
            {cart.items.map((item) => (
              <li key={item.id} className="flex gap-3">
                <div className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl ?? "/placeholder.svg"} alt="" className="size-12 rounded border border-ink-200 object-cover" />
                  <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink-700 text-[10px] font-medium text-white">
                    {item.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink-800">{item.title}</p>
                  {item.variantTitle && <p className="text-[12px] text-ink-500">{item.variantTitle}</p>}
                </div>
                <span className="tabular text-[13px] text-ink-800">
                  {formatMoney(item.lineTotal, cart.currency)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 text-[13.5px]">
            <Row label="Subtotal" value={formatMoney(cart.subtotal, cart.currency)} />
            {cart.discountTotal > 0 && (
              <Row label="Discount" value={`−${formatMoney(cart.discountTotal, cart.currency)}`} positive />
            )}
            <Row label="Shipping" value={cart.shipping === 0 ? "Free" : formatMoney(cart.shipping, cart.currency)} />
            {cart.taxEnabled && <Row label="Tax" value={formatMoney(cart.tax, cart.currency)} />}
            <div className="flex justify-between border-t border-ink-200 pt-3 text-[16px] font-semibold text-ink-900">
              <dt>Total</dt>
              <dd className="tabular">{formatMoney(cart.total, cart.currency)}</dd>
            </div>
          </dl>

          <button
            type="submit"
            disabled={pending || !simulated}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-[15px] font-medium text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--store-primary)" }}
          >
            <Lock className="size-4" />
            {pending ? "Placing order…" : `Place order · ${formatMoney(cart.total, cart.currency)}`}
          </button>

          <Link href={`${base}/cart`} className="mt-3 block text-center text-[13px] text-ink-500 hover:text-ink-800">
            Back to cart
          </Link>
        </aside>
      </form>
    </div>
  );
}

function Field({
  label, error, required, children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* The control sits inside the label so assistive tech announces the
          field name — a htmlFor/id pair can't be wired up here because the
          children are opaque to this wrapper. */}
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-[var(--color-signal-negative)]">*</span>}
        </span>
        {children}
      </label>
      {error && <p className="mt-1 text-[12px] text-[var(--color-signal-negative)]">{error}</p>}
    </div>
  );
}

function AddressFields({
  value, onChange, errors, prefix,
}: {
  value: Address;
  onChange: (value: Address) => void;
  errors: Record<string, string>;
  prefix: string;
}) {
  const input = "h-11 w-full rounded-md border border-ink-200 px-3 text-[14px] outline-none focus:border-ink-400";
  function set<K extends keyof Address>(key: K, next: Address[K]) {
    onChange({ ...value, [key]: next });
  }
  return (
    <div className="space-y-3">
      <Field label="Full name" required error={errors[`${prefix}.name`]}>
        <input required value={value.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className={input} />
      </Field>
      <Field label="Address" required error={errors[`${prefix}.line1`]}>
        <input required value={value.line1} onChange={(e) => set("line1", e.target.value)} autoComplete="address-line1" className={input} />
      </Field>
      <Field label="Apartment, suite, etc.">
        <input value={value.line2} onChange={(e) => set("line2", e.target.value)} autoComplete="address-line2" className={input} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="City" required error={errors[`${prefix}.city`]}>
          <input required value={value.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" className={input} />
        </Field>
        <Field label="State / region" required error={errors[`${prefix}.region`]}>
          <input required value={value.region} onChange={(e) => set("region", e.target.value)} autoComplete="address-level1" className={input} />
        </Field>
        <Field label="Postal code" required error={errors[`${prefix}.postalCode`]}>
          <input required value={value.postalCode} onChange={(e) => set("postalCode", e.target.value)} autoComplete="postal-code" className={input} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Country" required error={errors[`${prefix}.country`]}>
          <select value={value.country} onChange={(e) => set("country", e.target.value)} className={input}>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
          </select>
        </Field>
        <Field label="Phone">
          <input value={value.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" className={input} />
        </Field>
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
