/**
 * Blank form values.
 *
 * These live in a plain module rather than beside their client components on
 * purpose: a constant exported from a `"use client"` file becomes a client
 * reference when a server component imports it, so spreading it server-side
 * yields a proxy with none of the real keys.
 */
import type { ProductFormValues } from "@/components/admin/product-form";
import type { CollectionFormValues } from "@/components/admin/collection-form";
import type { DiscountFormValues } from "@/components/admin/discount-form";
import type { CampaignFormValues } from "@/components/admin/campaign-editor";
import type { PageFormValues } from "@/components/admin/page-form";

export const EMPTY_PRODUCT: ProductFormValues = {
  title: "", slug: "", description: "", status: "DRAFT",
  price: "", compareAtPrice: "", cost: "", sku: "", barcode: "",
  trackInventory: true, inventory: "0", categoryId: "", collectionIds: [],
  vendor: "", tags: [], seoTitle: "", seoDescription: "",
  images: [], variants: [], optionAxes: [],
};

export const EMPTY_COLLECTION: CollectionFormValues = {
  title: "", slug: "", description: "", imageUrl: null, type: "MANUAL",
  match: "all", rules: [], productIds: [], visible: true,
  seoTitle: "", seoDescription: "",
};

export const EMPTY_DISCOUNT: DiscountFormValues = {
  title: "", code: "", automatic: false, type: "PERCENTAGE", status: "DRAFT",
  value: "10", minPurchase: "", minQuantity: "", usageLimit: "", oncePerCustomer: false,
  appliesToScope: "all", productIds: [], collectionIds: [],
  buyQuantity: "2", getQuantity: "1", getDiscountPercent: "100",
  startsAt: "", endsAt: "",
};

export const EMPTY_CAMPAIGN: CampaignFormValues = {
  name: "", subject: "", previewText: "", fromName: "", fromEmail: "",
  audience: "subscribers",
  blocks: [
    { type: "heading", text: "A heading" },
    { type: "text", text: "" },
  ],
};

export const EMPTY_PAGE: PageFormValues = {
  title: "", slug: "", body: "<p></p>", published: false, showInNav: false,
  seoTitle: "", seoDescription: "",
};
