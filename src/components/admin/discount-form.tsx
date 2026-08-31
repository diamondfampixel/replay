"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { ConfirmDialog } from "@/components/admin/confirm";
import { createDiscountAction, deleteDiscountAction, updateDiscountAction } from "@/app/actions/commerce";

export type DiscountFormValues = {
  title: string;
  code: string;
  automatic: boolean;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING" | "BUY_X_GET_Y";
  status: "DRAFT" | "ACTIVE" | "SCHEDULED" | "EXPIRED" | "DISABLED";
  value: string;
  minPurchase: string;
  minQuantity: string;
  usageLimit: string;
  oncePerCustomer: boolean;
  appliesToScope: "all" | "products" | "collections";
  productIds: string[];
  collectionIds: string[];
  buyQuantity: string;
  getQuantity: string;
  getDiscountPercent: string;
  startsAt: string;
  endsAt: string;
};


function toLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function randomCode() {
  const words = ["SAVE", "EXTRA", "TREAT", "BONUS", "FRESH", "SPARK"];
  return `${words[Math.floor(Math.random() * words.length)]}${Math.floor(Math.random() * 90 + 10)}`;
}

export function DiscountForm({
  discountId,
  initial,
  products,
  collections,
  currency,
  usageCount,
  canWrite,
}: {
  discountId?: string;
  initial: DiscountFormValues;
  products: Array<{ id: string; title: string }>;
  collections: Array<{ id: string; title: string }>;
  currency: string;
  usageCount?: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(() => ({
    ...initial,
    // A blank start date means "now" — resolved on the client so the value is
    // in the operator's timezone rather than the server's.
    startsAt: initial.startsAt || toLocalDateTimeInput(new Date()),
  }));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  function set<K extends keyof DiscountFormValues>(key: K, value: DiscountFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function save() {
    setErrors({});
    startTransition(async () => {
      const payload = {
        title: values.title,
        code: values.automatic ? null : values.code.toUpperCase(),
        automatic: values.automatic,
        type: values.type,
        status: values.status,
        value: Number(values.value || 0),
        minPurchase: values.minPurchase ? Number(values.minPurchase) : null,
        minQuantity: values.minQuantity ? Number(values.minQuantity) : null,
        usageLimit: values.usageLimit ? Number(values.usageLimit) : null,
        oncePerCustomer: values.oncePerCustomer,
        appliesToScope: values.appliesToScope,
        productIds: values.productIds,
        collectionIds: values.collectionIds,
        buyQuantity: Number(values.buyQuantity || 2),
        getQuantity: Number(values.getQuantity || 1),
        getDiscountPercent: Number(values.getDiscountPercent || 100),
        startsAt: new Date(values.startsAt),
        endsAt: values.endsAt ? new Date(values.endsAt) : null,
      };
      const result = discountId
        ? await updateDiscountAction(discountId, payload)
        : await createDiscountAction(payload);

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      setDirty(false);
      if (!discountId) router.push(`/admin/discounts/${result.data.id}`);
      else router.refresh();
    });
  }

  const summary = React.useMemo(() => {
    const scope =
      values.appliesToScope === "all" ? "the entire store"
      : values.appliesToScope === "products" ? `${values.productIds.length} selected product${values.productIds.length === 1 ? "" : "s"}`
      : `${values.collectionIds.length} selected collection${values.collectionIds.length === 1 ? "" : "s"}`;

    const amount =
      values.type === "PERCENTAGE" ? `${values.value || 0}% off`
      : values.type === "FIXED_AMOUNT" ? `${currency === "USD" ? "$" : ""}${values.value || 0} off`
      : values.type === "FREE_SHIPPING" ? "Free shipping"
      : `Buy ${values.buyQuantity}, get ${values.getQuantity} at ${values.getDiscountPercent}% off`;

    const conditions: string[] = [];
    if (values.minPurchase) conditions.push(`minimum spend $${values.minPurchase}`);
    if (values.minQuantity) conditions.push(`minimum ${values.minQuantity} items`);
    if (values.usageLimit) conditions.push(`limited to ${values.usageLimit} uses`);
    if (values.endsAt) conditions.push(`ends ${new Date(values.endsAt).toLocaleDateString()}`);

    return `${amount} on ${scope}${conditions.length ? `, ${conditions.join(", ")}` : ""}.`;
  }, [values, currency]);

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader
        breadcrumb={
          <Link href="/admin/discounts" className="inline-flex items-center gap-1 hover:text-ink-800">
            <ArrowLeft className="size-3" />
            Discounts
          </Link>
        }
        title={discountId ? values.title || "Untitled discount" : "New discount"}
        description={usageCount !== undefined ? `Used ${usageCount} time${usageCount === 1 ? "" : "s"}` : undefined}
        actions={
          <>
            {discountId && canWrite && (
              <Button size="sm" variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                Delete
              </Button>
            )}
            {canWrite && (
              <Button size="sm" variant="primary" onClick={save} loading={pending} disabled={!dirty && Boolean(discountId)}>
                {discountId ? (dirty ? "Save changes" : "Saved") : "Create discount"}
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <Field label="Internal title" required error={errors.title} htmlFor="title" hint="Only you see this.">
              <Input
                id="title"
                value={values.title}
                disabled={!canWrite}
                onChange={(event) => set("title", event.target.value)}
                placeholder="Summer sale 20% off"
              />
            </Field>

            <div className="flex items-center justify-between rounded-md border border-ink-200 px-3 py-2">
              <div>
                <Label className="mb-0" htmlFor="automatic">Automatic discount</Label>
                <p className="text-[12px] text-ink-500">Applies at checkout without a code.</p>
              </div>
              <Switch
                id="automatic"
                checked={values.automatic}
                disabled={!canWrite}
                onCheckedChange={(checked) => set("automatic", checked)}
              />
            </div>

            {!values.automatic && (
              <Field label="Discount code" required error={errors.code} htmlFor="code">
                <div className="flex gap-2">
                  <Input
                    id="code"
                    value={values.code}
                    disabled={!canWrite}
                    onChange={(event) => set("code", event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                    placeholder="SUMMER20"
                    className="font-mono uppercase"
                  />
                  {canWrite && (
                    <Button size="md" variant="secondary" onClick={() => set("code", randomCode())}>
                      <RefreshCw />
                      Generate
                    </Button>
                  )}
                </div>
              </Field>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Value</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Discount type" htmlFor="type">
                <Select
                  id="type"
                  value={values.type}
                  disabled={!canWrite}
                  onChange={(event) => set("type", event.target.value as DiscountFormValues["type"])}
                >
                  <option value="PERCENTAGE">Percentage off</option>
                  <option value="FIXED_AMOUNT">Fixed amount off</option>
                  <option value="FREE_SHIPPING">Free shipping</option>
                  <option value="BUY_X_GET_Y">Buy X get Y</option>
                </Select>
              </Field>

              {(values.type === "PERCENTAGE" || values.type === "FIXED_AMOUNT") && (
                <Field
                  label={values.type === "PERCENTAGE" ? "Percentage" : "Amount"}
                  required
                  error={errors.value}
                  htmlFor="value"
                >
                  <Input
                    id="value"
                    type="number"
                    min="0"
                    max={values.type === "PERCENTAGE" ? "100" : undefined}
                    step={values.type === "PERCENTAGE" ? "1" : "0.01"}
                    value={values.value}
                    disabled={!canWrite}
                    onChange={(event) => set("value", event.target.value)}
                  />
                </Field>
              )}
            </div>

            {values.type === "BUY_X_GET_Y" && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Customer buys" htmlFor="buyQuantity">
                  <Input id="buyQuantity" type="number" min="1" value={values.buyQuantity} disabled={!canWrite}
                    onChange={(e) => set("buyQuantity", e.target.value)} />
                </Field>
                <Field label="Customer gets" htmlFor="getQuantity">
                  <Input id="getQuantity" type="number" min="1" value={values.getQuantity} disabled={!canWrite}
                    onChange={(e) => set("getQuantity", e.target.value)} />
                </Field>
                <Field label="At % off" htmlFor="getDiscountPercent">
                  <Input id="getDiscountPercent" type="number" min="1" max="100" value={values.getDiscountPercent} disabled={!canWrite}
                    onChange={(e) => set("getDiscountPercent", e.target.value)} />
                </Field>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Applies to</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={values.appliesToScope}
              disabled={!canWrite}
              onChange={(event) => set("appliesToScope", event.target.value as DiscountFormValues["appliesToScope"])}
              aria-label="Discount scope"
            >
              <option value="all">All products</option>
              <option value="products">Specific products</option>
              <option value="collections">Specific collections</option>
            </Select>

            {values.appliesToScope === "products" && (
              <MultiSelect
                items={products.map((p) => ({ id: p.id, label: p.title }))}
                selected={values.productIds}
                disabled={!canWrite}
                onChange={(ids) => set("productIds", ids)}
                emptyLabel="No products yet."
              />
            )}
            {values.appliesToScope === "collections" && (
              <MultiSelect
                items={collections.map((c) => ({ id: c.id, label: c.title }))}
                selected={values.collectionIds}
                disabled={!canWrite}
                onChange={(ids) => set("collectionIds", ids)}
                emptyLabel="No collections yet."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Requirements and limits</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Field label="Minimum purchase" htmlFor="minPurchase" hint="Leave blank for none">
              <Input id="minPurchase" type="number" min="0" step="0.01" value={values.minPurchase} disabled={!canWrite}
                onChange={(e) => set("minPurchase", e.target.value)} />
            </Field>
            <Field label="Minimum quantity" htmlFor="minQuantity" hint="Leave blank for none">
              <Input id="minQuantity" type="number" min="1" value={values.minQuantity} disabled={!canWrite}
                onChange={(e) => set("minQuantity", e.target.value)} />
            </Field>
            <Field label="Total usage limit" htmlFor="usageLimit" hint="Leave blank for unlimited">
              <Input id="usageLimit" type="number" min="1" value={values.usageLimit} disabled={!canWrite}
                onChange={(e) => set("usageLimit", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Schedule and status</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Field label="Starts" htmlFor="startsAt">
              <Input id="startsAt" type="datetime-local" value={values.startsAt} disabled={!canWrite}
                onChange={(e) => set("startsAt", e.target.value)} />
            </Field>
            <Field label="Ends" error={errors.endsAt} htmlFor="endsAt" hint="Leave blank to run indefinitely">
              <Input id="endsAt" type="datetime-local" value={values.endsAt} disabled={!canWrite}
                onChange={(e) => set("endsAt", e.target.value)} />
            </Field>
            <Field label="Status" htmlFor="status">
              <Select id="status" value={values.status} disabled={!canWrite}
                onChange={(e) => set("status", e.target.value as DiscountFormValues["status"])}>
                <option value="DRAFT">Draft — not usable</option>
                <option value="ACTIVE">Active — live at checkout</option>
                <option value="DISABLED">Disabled — turned off</option>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Summary</p>
          <p className="mt-1 text-[13.5px] text-ink-800">{summary}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={values.status === "ACTIVE" ? "success" : "neutral"}>{values.status.toLowerCase()}</Badge>
            {!values.automatic && values.code && <Badge tone="outline" className="font-mono">{values.code}</Badge>}
            {values.automatic && <Badge tone="info">automatic</Badge>}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${values.title}?`}
        description="Existing orders keep their recorded discount. New checkouts will no longer accept this code."
        confirmLabel="Delete discount"
        destructive
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            if (!discountId) return;
            const result = await deleteDiscountAction(discountId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Discount deleted");
            router.push("/admin/discounts");
          })
        }
      />
    </div>
  );
}

function MultiSelect({
  items, selected, onChange, disabled, emptyLabel,
}: {
  items: Array<{ id: string; label: string }>;
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
  emptyLabel: string;
}) {
  const [query, setQuery] = React.useState("");
  const filtered = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter…"
        className="mb-2 h-8 text-[13px]"
        disabled={disabled}
      />
      <div className="scroll-thin max-h-52 space-y-0.5 overflow-y-auto rounded-md border border-ink-200 p-2">
        {filtered.length === 0 && <p className="px-1 py-2 text-[12px] text-ink-400">{emptyLabel}</p>}
        {filtered.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[13px] hover:bg-ink-50">
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--color-pine-600)]"
              checked={selected.includes(item.id)}
              disabled={disabled}
              onChange={(event) =>
                onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))
              }
            />
            <span className="truncate text-ink-700">{item.label}</span>
          </label>
        ))}
      </div>
      <p className="mt-1 text-[11.5px] text-ink-400">{selected.length} selected</p>
    </div>
  );
}
