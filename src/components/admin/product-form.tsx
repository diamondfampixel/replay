"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ImageManager, type EditableImage } from "@/components/admin/media-picker";
import { ConfirmDialog } from "@/components/admin/confirm";
import { PageHeader } from "@/components/ui/page";
import { slugify } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { createProductAction, deleteProductsAction, updateProductAction } from "@/app/actions/catalog";

export type VariantDraft = {
  id?: string;
  title: string;
  options: Record<string, string>;
  sku: string;
  price: string;
  inventory: string;
  imageUrl: string | null;
};

export type ProductFormValues = {
  title: string;
  slug: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  price: string;
  compareAtPrice: string;
  cost: string;
  sku: string;
  barcode: string;
  trackInventory: boolean;
  inventory: string;
  categoryId: string;
  collectionIds: string[];
  vendor: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  images: EditableImage[];
  variants: VariantDraft[];
  optionAxes: Array<{ name: string; values: string[] }>;
};


function toPayload(values: ProductFormValues) {
  const num = (value: string) => (value.trim() === "" ? null : Number(value));
  return {
    title: values.title,
    slug: values.slug || slugify(values.title),
    description: values.description || null,
    status: values.status,
    price: Number(values.price || 0),
    compareAtPrice: num(values.compareAtPrice),
    cost: num(values.cost),
    sku: values.sku || null,
    barcode: values.barcode || null,
    trackInventory: values.trackInventory,
    inventory: Number(values.inventory || 0),
    categoryId: values.categoryId || null,
    collectionIds: values.collectionIds,
    vendor: values.vendor || null,
    tags: values.tags,
    seoTitle: values.seoTitle || null,
    seoDescription: values.seoDescription || null,
    images: values.images.map((image) => ({ url: image.url, alt: image.alt ?? null })),
    variants: values.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      options: variant.options,
      sku: variant.sku || null,
      price: variant.price.trim() === "" ? null : Number(variant.price),
      inventory: Number(variant.inventory || 0),
      imageUrl: variant.imageUrl,
    })),
  };
}

export function ProductForm({
  productId,
  initial,
  categories,
  collections,
  currency,
  storefrontUrl,
  stats,
  canWrite,
}: {
  productId?: string;
  initial: ProductFormValues;
  categories: Array<{ id: string; name: string }>;
  collections: Array<{ id: string; title: string }>;
  currency: string;
  storefrontUrl?: string;
  stats?: {
    unitsSold: number; revenue: number; orderCount: number;
    productViews: number; averageRating: number | null; reviewCount: number;
  };
  canWrite: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const [tagDraft, setTagDraft] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function save() {
    setErrors({});
    startTransition(async () => {
      const payload = toPayload(values);
      const result = productId
        ? await updateProductAction(productId, payload)
        : await createProductAction(payload);

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      setDirty(false);
      if (!productId) router.push(`/admin/products/${result.data.id}`);
      else router.refresh();
    });
  }

  // -- variant matrix -------------------------------------------------------
  function regenerateVariants(axes: ProductFormValues["optionAxes"]) {
    const usable = axes.filter((axis) => axis.name.trim() && axis.values.length);
    if (!usable.length) {
      set("variants", []);
      set("optionAxes", axes);
      return;
    }

    let combos: Array<Record<string, string>> = [{}];
    for (const axis of usable) {
      combos = combos.flatMap((combo) => axis.values.map((value) => ({ ...combo, [axis.name]: value })));
    }

    const byKey = new Map(values.variants.map((variant) => [JSON.stringify(variant.options), variant]));
    const next = combos.slice(0, 120).map((options) => {
      const existing = byKey.get(JSON.stringify(options));
      return (
        existing ?? {
          title: Object.values(options).join(" / "),
          options,
          sku: "",
          price: "",
          inventory: "0",
          imageUrl: null,
        }
      );
    });

    setValues((prev) => ({ ...prev, optionAxes: axes, variants: next }));
    setDirty(true);
  }

  const totalVariantInventory = values.variants.reduce(
    (sum, variant) => sum + (Number(variant.inventory) || 0),
    0,
  );

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        breadcrumb={
          <Link href="/admin/products" className="inline-flex items-center gap-1 hover:text-ink-800">
            <ArrowLeft className="size-3" />
            Products
          </Link>
        }
        title={productId ? values.title || "Untitled product" : "New product"}
        description={
          stats && (
            <span className="tabular">
              {stats.unitsSold} units · {formatMoney(stats.revenue, currency)} revenue ·{" "}
              {stats.productViews} views
              {stats.averageRating !== null && ` · ★ ${stats.averageRating.toFixed(1)} (${stats.reviewCount})`}
            </span>
          )
        }
        actions={
          <>
            {storefrontUrl && values.status === "ACTIVE" && (
              <Button asChild size="sm" variant="secondary">
                <a href={storefrontUrl} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  View
                </a>
              </Button>
            )}
            {productId && canWrite && (
              <Button size="sm" variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                Delete
              </Button>
            )}
            {canWrite && (
              <Button size="sm" variant="primary" onClick={save} loading={pending} disabled={!dirty && Boolean(productId)}>
                {productId ? (dirty ? "Save changes" : "Saved") : "Create product"}
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
                  id="title"
                  value={values.title}
                  onChange={(event) => {
                    set("title", event.target.value);
                    if (!productId) set("slug", slugify(event.target.value));
                  }}
                  placeholder="Essential Hoodie"
                  disabled={!canWrite}
                />
              </Field>
              <Field
                label="Description"
                error={errors.description}
                htmlFor="description"
                hint="Plain text or simple HTML. Shown on the product page."
              >
                <Textarea
                  id="description"
                  value={values.description}
                  onChange={(event) => set("description", event.target.value)}
                  rows={6}
                  disabled={!canWrite}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Media</CardTitle></CardHeader>
            <CardContent>
              <ImageManager images={values.images} onChange={(images) => set("images", images)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Field label="Price" required error={errors.price} htmlFor="price">
                <Input
                  id="price" type="number" step="0.01" min="0" inputMode="decimal"
                  value={values.price}
                  onChange={(event) => set("price", event.target.value)}
                  disabled={!canWrite}
                />
              </Field>
              <Field label="Compare-at price" error={errors.compareAtPrice} htmlFor="compareAtPrice"
                hint="Shown struck through">
                <Input
                  id="compareAtPrice" type="number" step="0.01" min="0"
                  value={values.compareAtPrice}
                  onChange={(event) => set("compareAtPrice", event.target.value)}
                  disabled={!canWrite}
                />
              </Field>
              <Field label="Cost per item" error={errors.cost} htmlFor="cost" hint="Not shown to customers">
                <Input
                  id="cost" type="number" step="0.01" min="0"
                  value={values.cost}
                  onChange={(event) => set("cost", event.target.value)}
                  disabled={!canWrite}
                />
              </Field>
              {values.cost && values.price && Number(values.price) > 0 && (
                <p className="tabular text-[12px] text-ink-500 sm:col-span-3">
                  Margin{" "}
                  <span className="font-medium text-ink-800">
                    {(((Number(values.price) - Number(values.cost)) / Number(values.price)) * 100).toFixed(1)}%
                  </span>{" "}
                  · Profit {formatMoney(Number(values.price) - Number(values.cost), currency)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="mb-0 text-[12.5px]" htmlFor="trackInventory">Track quantity</Label>
                <Switch
                  id="trackInventory"
                  checked={values.trackInventory}
                  onCheckedChange={(checked) => set("trackInventory", checked)}
                  disabled={!canWrite}
                />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Field label="SKU" htmlFor="sku">
                <Input id="sku" value={values.sku} onChange={(e) => set("sku", e.target.value)} disabled={!canWrite} />
              </Field>
              <Field label="Barcode" htmlFor="barcode">
                <Input id="barcode" value={values.barcode} onChange={(e) => set("barcode", e.target.value)} disabled={!canWrite} />
              </Field>
              <Field
                label="Quantity"
                htmlFor="inventory"
                hint={values.variants.length ? "Summed from variants" : undefined}
              >
                <Input
                  id="inventory" type="number" min="0"
                  value={values.variants.length ? String(totalVariantInventory) : values.inventory}
                  onChange={(event) => set("inventory", event.target.value)}
                  disabled={!canWrite || !values.trackInventory || values.variants.length > 0}
                />
              </Field>
            </CardContent>
          </Card>

          <VariantEditor
            axes={values.optionAxes}
            variants={values.variants}
            currency={currency}
            basePrice={values.price}
            disabled={!canWrite}
            onAxesChange={regenerateVariants}
            onVariantsChange={(variants) => set("variants", variants)}
          />

          <Card>
            <CardHeader><CardTitle>Search engine listing</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Page title" htmlFor="seoTitle" hint={`${values.seoTitle.length}/160`}>
                <Input
                  id="seoTitle" value={values.seoTitle}
                  onChange={(event) => set("seoTitle", event.target.value.slice(0, 160))}
                  placeholder={values.title}
                  disabled={!canWrite}
                />
              </Field>
              <Field label="Meta description" htmlFor="seoDescription" hint={`${values.seoDescription.length}/320`}>
                <Textarea
                  id="seoDescription" rows={2} value={values.seoDescription}
                  onChange={(event) => set("seoDescription", event.target.value.slice(0, 320))}
                  disabled={!canWrite}
                />
              </Field>
              <Field label="URL slug" htmlFor="slug" error={errors.slug}>
                <Input
                  id="slug" value={values.slug}
                  onChange={(event) => set("slug", slugify(event.target.value))}
                  disabled={!canWrite}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={values.status}
                onChange={(event) => set("status", event.target.value as ProductFormValues["status"])}
                disabled={!canWrite}
                aria-label="Product status"
              >
                <option value="DRAFT">Draft — hidden from the storefront</option>
                <option value="ACTIVE">Active — visible and purchasable</option>
                <option value="ARCHIVED">Archived — hidden, kept for records</option>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Organisation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Category" htmlFor="categoryId">
                <Select
                  id="categoryId" value={values.categoryId}
                  onChange={(event) => set("categoryId", event.target.value)}
                  disabled={!canWrite}
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Vendor" htmlFor="vendor">
                <Input id="vendor" value={values.vendor} onChange={(e) => set("vendor", e.target.value)} disabled={!canWrite} />
              </Field>

              <div>
                <Label>Collections</Label>
                <div className="scroll-thin max-h-40 space-y-1 overflow-y-auto rounded-md border border-ink-200 p-2">
                  {collections.length === 0 && (
                    <p className="px-1 py-2 text-[12px] text-ink-400">No collections yet.</p>
                  )}
                  {collections.map((collection) => (
                    <label key={collection.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[13px] hover:bg-ink-50">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--color-pine-600)]"
                        checked={values.collectionIds.includes(collection.id)}
                        disabled={!canWrite}
                        onChange={(event) =>
                          set(
                            "collectionIds",
                            event.target.checked
                              ? [...values.collectionIds, collection.id]
                              : values.collectionIds.filter((id) => id !== collection.id),
                          )
                        }
                      />
                      <span className="truncate text-ink-700">{collection.title}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[11.5px] text-ink-400">
                  Rule-based collections are matched automatically and are not listed here.
                </p>
              </div>

              <div>
                <Label htmlFor="tagDraft">Tags</Label>
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {values.tags.map((tag) => (
                    <Badge key={tag} tone="neutral" className="pr-1">
                      {tag}
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => set("tags", values.tags.filter((t) => t !== tag))}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-ink-200"
                          aria-label={`Remove tag ${tag}`}
                        >
                          <X className="size-2.5" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
                <Input
                  id="tagDraft"
                  value={tagDraft}
                  disabled={!canWrite}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== ",") return;
                    event.preventDefault();
                    const tag = tagDraft.trim().toLowerCase();
                    if (tag && !values.tags.includes(tag)) set("tags", [...values.tags, tag]);
                    setTagDraft("");
                  }}
                  placeholder="Type and press Enter"
                  className="h-8 text-[13px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${values.title}?`}
        description="This permanently removes the product, its variants and images. Past orders keep the recorded title and price."
        confirmLabel="Delete permanently"
        destructive
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            if (!productId) return;
            const result = await deleteProductsAction([productId]);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Product deleted");
            router.push("/admin/products");
          })
        }
      />
    </div>
  );
}

function VariantEditor({
  axes, variants, currency, basePrice, disabled, onAxesChange, onVariantsChange,
}: {
  axes: Array<{ name: string; values: string[] }>;
  variants: VariantDraft[];
  currency: string;
  basePrice: string;
  disabled: boolean;
  onAxesChange: (axes: Array<{ name: string; values: string[] }>) => void;
  onVariantsChange: (variants: VariantDraft[]) => void;
}) {
  const [valueDrafts, setValueDrafts] = React.useState<Record<number, string>>({});

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Variants</CardTitle>
          <p className="mt-0.5 text-[12.5px] text-ink-500">
            Add options like Size or Colour — every combination becomes a purchasable variant.
          </p>
        </div>
        {!disabled && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAxesChange([...axes, { name: "", values: [] }])}
            disabled={axes.length >= 3}
          >
            <Plus />
            Add option
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {axes.length === 0 && (
          <p className="text-[13px] text-ink-500">
            No options yet. This product is sold as a single item.
          </p>
        )}

        {axes.map((axis, index) => (
          <div key={index} className="rounded-md border border-ink-200 p-3">
            <div className="flex items-center gap-2">
              <Input
                value={axis.name}
                placeholder="Option name (e.g. Size)"
                disabled={disabled}
                onChange={(event) => {
                  const next = axes.map((a, i) => (i === index ? { ...a, name: event.target.value } : a));
                  onAxesChange(next);
                }}
                className="h-8 max-w-52 text-[13px]"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onAxesChange(axes.filter((_, i) => i !== index))}
                  className="ml-auto rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-[var(--color-signal-negative)]"
                  aria-label="Remove option"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {axis.values.map((value) => (
                <Badge key={value} tone="neutral" className="pr-1">
                  {value}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() =>
                        onAxesChange(
                          axes.map((a, i) => (i === index ? { ...a, values: a.values.filter((v) => v !== value) } : a)),
                        )
                      }
                      className="ml-0.5 rounded-full p-0.5 hover:bg-ink-200"
                      aria-label={`Remove ${value}`}
                    >
                      <X className="size-2.5" />
                    </button>
                  )}
                </Badge>
              ))}
              <Input
                value={valueDrafts[index] ?? ""}
                disabled={disabled}
                onChange={(event) => setValueDrafts((prev) => ({ ...prev, [index]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== ",") return;
                  event.preventDefault();
                  const value = (valueDrafts[index] ?? "").trim();
                  if (!value || axis.values.includes(value)) return;
                  onAxesChange(axes.map((a, i) => (i === index ? { ...a, values: [...a.values, value] } : a)));
                  setValueDrafts((prev) => ({ ...prev, [index]: "" }));
                }}
                placeholder="Add value + Enter"
                className="h-7 w-40 text-[12.5px]"
              />
            </div>
          </div>
        ))}

        {variants.length > 0 && (
          <TableWrap className="rounded-md border border-ink-200">
            <Table>
              <THead>
                <tr>
                  <TH>Variant</TH>
                  <TH>SKU</TH>
                  <TH align="right">Price</TH>
                  <TH align="right">Inventory</TH>
                </tr>
              </THead>
              <TBody>
                {variants.map((variant, index) => (
                  <TR key={index}>
                    <TD className="font-medium text-ink-800">{variant.title}</TD>
                    <TD>
                      <Input
                        value={variant.sku}
                        disabled={disabled}
                        onChange={(event) =>
                          onVariantsChange(variants.map((v, i) => (i === index ? { ...v, sku: event.target.value } : v)))
                        }
                        className="h-7 w-28 text-[12.5px]"
                        aria-label={`SKU for ${variant.title}`}
                      />
                    </TD>
                    <TD align="right">
                      <Input
                        type="number" step="0.01" min="0"
                        value={variant.price}
                        disabled={disabled}
                        placeholder={basePrice || "0.00"}
                        onChange={(event) =>
                          onVariantsChange(variants.map((v, i) => (i === index ? { ...v, price: event.target.value } : v)))
                        }
                        className="h-7 w-24 text-right text-[12.5px]"
                        aria-label={`Price for ${variant.title}`}
                      />
                    </TD>
                    <TD align="right">
                      <Input
                        type="number" min="0"
                        value={variant.inventory}
                        disabled={disabled}
                        onChange={(event) =>
                          onVariantsChange(variants.map((v, i) => (i === index ? { ...v, inventory: event.target.value } : v)))
                        }
                        className="h-7 w-20 text-right text-[12.5px]"
                        aria-label={`Inventory for ${variant.title}`}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}

        {variants.length > 0 && (
          <p className="tabular text-[12px] text-ink-500">
            {variants.length} variants · {variants.reduce((s, v) => s + (Number(v.inventory) || 0), 0)} units ·
            variants without a price override sell at {formatMoney(Number(basePrice) || 0, currency)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
