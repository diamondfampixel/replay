"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GripVertical, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { ImageField } from "@/components/admin/media-picker";
import { ConfirmDialog } from "@/components/admin/confirm";
import { slugify } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import {
  createCollectionAction, deleteCollectionAction, updateCollectionAction,
} from "@/app/actions/catalog";

export type CollectionFormValues = {
  title: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  type: "MANUAL" | "AUTOMATIC";
  match: "all" | "any";
  rules: Array<{ field: string; operator: string; value: string }>;
  productIds: string[];
  visible: boolean;
  seoTitle: string;
  seoDescription: string;
};


const FIELDS = [
  { value: "tag", label: "Product tag" },
  { value: "title", label: "Product title" },
  { value: "price", label: "Price" },
  { value: "category", label: "Category" },
  { value: "vendor", label: "Vendor" },
  { value: "inventory", label: "Inventory quantity" },
];

const OPERATORS_BY_FIELD: Record<string, Array<{ value: string; label: string }>> = {
  tag: [
    { value: "contains", label: "is" },
    { value: "not_contains", label: "is not" },
  ],
  title: [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
    { value: "starts_with", label: "starts with" },
    { value: "equals", label: "is exactly" },
  ],
  vendor: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
    { value: "contains", label: "contains" },
  ],
  category: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
  ],
  price: [
    { value: "greater_than", label: "is more than" },
    { value: "less_than", label: "is less than" },
    { value: "equals", label: "equals" },
  ],
  inventory: [
    { value: "greater_than", label: "is more than" },
    { value: "less_than", label: "is less than" },
    { value: "equals", label: "equals" },
  ],
};

export type PickerProduct = {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  status: string;
};

export function CollectionForm({
  collectionId,
  initial,
  allProducts,
  matchedProducts,
  currency,
  storefrontUrl,
  canWrite,
}: {
  collectionId?: string;
  initial: CollectionFormValues;
  allProducts: PickerProduct[];
  matchedProducts?: PickerProduct[];
  currency: string;
  storefrontUrl?: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [dirty, setDirty] = React.useState(false);

  function set<K extends keyof CollectionFormValues>(key: K, value: CollectionFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const productMap = React.useMemo(
    () => new Map(allProducts.map((product) => [product.id, product])),
    [allProducts],
  );

  const searchResults = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts
      .filter((product) => !values.productIds.includes(product.id))
      .filter((product) => !q || product.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, allProducts, values.productIds]);

  function save() {
    setErrors({});
    startTransition(async () => {
      const payload = {
        title: values.title,
        slug: values.slug || slugify(values.title),
        description: values.description || null,
        imageUrl: values.imageUrl,
        type: values.type,
        match: values.match,
        rules: values.rules,
        productIds: values.type === "MANUAL" ? values.productIds : [],
        visible: values.visible,
        seoTitle: values.seoTitle || null,
        seoDescription: values.seoDescription || null,
      };
      const result = collectionId
        ? await updateCollectionAction(collectionId, payload)
        : await createCollectionAction(payload);

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      setDirty(false);
      if (!collectionId) router.push(`/admin/collections/${result.data.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        breadcrumb={
          <Link href="/admin/collections" className="inline-flex items-center gap-1 hover:text-ink-800">
            <ArrowLeft className="size-3" />
            Collections
          </Link>
        }
        title={collectionId ? values.title || "Untitled collection" : "New collection"}
        actions={
          <>
            {storefrontUrl && (
              <Button asChild size="sm" variant="secondary">
                <a href={storefrontUrl} target="_blank" rel="noreferrer">View</a>
              </Button>
            )}
            {collectionId && canWrite && (
              <Button size="sm" variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                Delete
              </Button>
            )}
            {canWrite && (
              <Button size="sm" variant="primary" onClick={save} loading={pending} disabled={!dirty && Boolean(collectionId)}>
                {collectionId ? (dirty ? "Save changes" : "Saved") : "Create collection"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <Field label="Title" required error={errors.title} htmlFor="title">
                <Input
                  id="title" value={values.title} disabled={!canWrite}
                  onChange={(event) => {
                    set("title", event.target.value);
                    if (!collectionId) set("slug", slugify(event.target.value));
                  }}
                  placeholder="Summer"
                />
              </Field>
              <Field label="Description" htmlFor="description">
                <Textarea
                  id="description" rows={3} value={values.description} disabled={!canWrite}
                  onChange={(event) => set("description", event.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Products</CardTitle>
                <p className="mt-0.5 text-[12.5px] text-ink-500">
                  {values.type === "MANUAL"
                    ? "Choose products by hand."
                    : "Products are matched by rules and update automatically."}
                </p>
              </div>
              <Select
                value={values.type}
                disabled={!canWrite}
                onChange={(event) => set("type", event.target.value as "MANUAL" | "AUTOMATIC")}
                className="h-8 w-auto text-[13px]"
                aria-label="Collection type"
              >
                <option value="MANUAL">Manual</option>
                <option value="AUTOMATIC">Rule-based</option>
              </Select>
            </CardHeader>

            <CardContent className="space-y-3">
              {values.type === "AUTOMATIC" ? (
                <>
                  <div className="flex items-center gap-2 text-[13px] text-ink-600">
                    Products must match
                    <Select
                      value={values.match}
                      disabled={!canWrite}
                      onChange={(event) => set("match", event.target.value as "all" | "any")}
                      className="h-7 w-auto text-[12.5px]"
                      aria-label="Rule match mode"
                    >
                      <option value="all">all conditions</option>
                      <option value="any">any condition</option>
                    </Select>
                  </div>

                  {values.rules.map((rule, index) => {
                    const operators = OPERATORS_BY_FIELD[rule.field] ?? OPERATORS_BY_FIELD.title;
                    return (
                      <div key={index} className="flex flex-wrap items-center gap-1.5">
                        <Select
                          value={rule.field}
                          disabled={!canWrite}
                          onChange={(event) => {
                            const field = event.target.value;
                            const nextOperator = (OPERATORS_BY_FIELD[field] ?? operators)[0].value;
                            set("rules", values.rules.map((r, i) => (i === index ? { ...r, field, operator: nextOperator } : r)));
                          }}
                          className="h-8 w-auto min-w-32 text-[12.5px]"
                          aria-label="Rule field"
                        >
                          {FIELDS.map((field) => (
                            <option key={field.value} value={field.value}>{field.label}</option>
                          ))}
                        </Select>
                        <Select
                          value={rule.operator}
                          disabled={!canWrite}
                          onChange={(event) =>
                            set("rules", values.rules.map((r, i) => (i === index ? { ...r, operator: event.target.value } : r)))
                          }
                          className="h-8 w-auto min-w-28 text-[12.5px]"
                          aria-label="Rule operator"
                        >
                          {operators.map((operator) => (
                            <option key={operator.value} value={operator.value}>{operator.label}</option>
                          ))}
                        </Select>
                        <Input
                          value={rule.value}
                          disabled={!canWrite}
                          onChange={(event) =>
                            set("rules", values.rules.map((r, i) => (i === index ? { ...r, value: event.target.value } : r)))
                          }
                          className="h-8 max-w-40 text-[12.5px]"
                          placeholder={rule.field === "price" || rule.field === "inventory" ? "0" : "value"}
                          aria-label="Rule value"
                        />
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => set("rules", values.rules.filter((_, i) => i !== index))}
                            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-[var(--color-signal-negative)]"
                            aria-label="Remove rule"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {canWrite && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => set("rules", [...values.rules, { field: "tag", operator: "contains", value: "" }])}
                    >
                      <Plus />
                      Add condition
                    </Button>
                  )}

                  {matchedProducts && (
                    <div className="rounded-md border border-ink-200 bg-ink-50 p-3">
                      <p className="text-[12.5px] font-medium text-ink-700">
                        {matchedProducts.length} product{matchedProducts.length === 1 ? "" : "s"} currently match
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {matchedProducts.slice(0, 12).map((product) => (
                          <Badge key={product.id} tone="outline">{product.title}</Badge>
                        ))}
                        {matchedProducts.length > 12 && (
                          <Badge tone="neutral">+{matchedProducts.length - 12} more</Badge>
                        )}
                      </div>
                      <p className="mt-2 text-[11.5px] text-ink-400">
                        Saved rules are evaluated live — this preview reflects the rules last saved.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {canWrite && (
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search products to add…"
                        className="h-8 pl-8 text-[13px]"
                      />
                      {search && searchResults.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-ink-200 bg-white shadow-lg">
                          {searchResults.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => {
                                set("productIds", [...values.productIds, product.id]);
                                setSearch("");
                              }}
                              className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-ink-50"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={product.imageUrl ?? "/placeholder.svg"} alt="" className="size-7 rounded border border-ink-200 object-cover" />
                              <span className="flex-1 truncate text-[13px] text-ink-800">{product.title}</span>
                              <span className="tabular text-[12px] text-ink-500">
                                {formatMoney(product.price, currency)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {values.productIds.length === 0 ? (
                    <p className="py-4 text-center text-[13px] text-ink-500">
                      No products in this collection yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-ink-200 rounded-md border border-ink-200">
                      {values.productIds.map((productId, index) => {
                        const product = productMap.get(productId);
                        return (
                          <li key={productId} className="flex items-center gap-2.5 px-2.5 py-2">
                            <GripVertical className="size-3.5 shrink-0 text-ink-300" />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={product?.imageUrl ?? "/placeholder.svg"} alt="" className="size-8 shrink-0 rounded border border-ink-200 object-cover" />
                            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-800">
                              {product?.title ?? "Removed product"}
                            </span>
                            <span className="tabular text-[12px] text-ink-500">
                              {product ? formatMoney(product.price, currency) : "—"}
                            </span>
                            {canWrite && (
                              <div className="flex gap-0.5">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => {
                                    const next = [...values.productIds];
                                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                    set("productIds", next);
                                  }}
                                  className="rounded px-1 text-[11px] text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                                  aria-label="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={index === values.productIds.length - 1}
                                  onClick={() => {
                                    const next = [...values.productIds];
                                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                    set("productIds", next);
                                  }}
                                  className="rounded px-1 text-[11px] text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                                  aria-label="Move down"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => set("productIds", values.productIds.filter((id) => id !== productId))}
                                  className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-[var(--color-signal-negative)]"
                                  aria-label="Remove product"
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Search engine listing</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Page title" htmlFor="seoTitle">
                <Input id="seoTitle" value={values.seoTitle} disabled={!canWrite}
                  onChange={(event) => set("seoTitle", event.target.value)} placeholder={values.title} />
              </Field>
              <Field label="Meta description" htmlFor="seoDescription">
                <Textarea id="seoDescription" rows={2} value={values.seoDescription} disabled={!canWrite}
                  onChange={(event) => set("seoDescription", event.target.value)} />
              </Field>
              <Field label="URL slug" htmlFor="slug" error={errors.slug}>
                <Input id="slug" value={values.slug} disabled={!canWrite}
                  onChange={(event) => set("slug", slugify(event.target.value))} />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Visibility</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label className="mb-0" htmlFor="visible">Show on storefront</Label>
                <Switch id="visible" checked={values.visible} disabled={!canWrite}
                  onCheckedChange={(checked) => set("visible", checked)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Collection image</CardTitle></CardHeader>
            <CardContent>
              <ImageField value={values.imageUrl} onChange={(url) => set("imageUrl", url)} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${values.title}?`}
        description="Products stay in your catalog; only the collection and its ordering are removed. Any storefront section pointing at this collection will fall back to newest products."
        confirmLabel="Delete collection"
        destructive
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            if (!collectionId) return;
            const result = await deleteCollectionAction(collectionId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Collection deleted");
            router.push("/admin/collections");
          })
        }
      />
    </div>
  );
}
