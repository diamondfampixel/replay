import { z } from "zod";

const money = z.coerce.number().min(0).max(1_000_000).multipleOf(0.01, "Use at most two decimal places");
const optionalMoney = z.union([money, z.literal("").transform(() => null), z.null()]).optional();

export const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const variantInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Variant needs a name").max(120),
  options: z.record(z.string(), z.string()).default({}),
  sku: z.string().trim().max(60).optional().nullable(),
  price: optionalMoney,
  inventory: z.coerce.number().int().min(0).max(1_000_000).default(0),
  imageUrl: z.string().trim().max(500).optional().nullable(),
});

export const productImageInputSchema = z.object({
  id: z.string().optional(),
  url: z.string().trim().min(1).max(1000),
  alt: z.string().trim().max(200).optional().nullable(),
});

export const productInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(8000).optional().nullable(),
  status: productStatusSchema.default("DRAFT"),
  price: money,
  compareAtPrice: optionalMoney,
  cost: optionalMoney,
  sku: z.string().trim().max(60).optional().nullable(),
  barcode: z.string().trim().max(60).optional().nullable(),
  trackInventory: z.boolean().default(true),
  inventory: z.coerce.number().int().min(0).max(1_000_000).default(0),
  categoryId: z.string().optional().nullable(),
  collectionIds: z.array(z.string()).default([]),
  vendor: z.string().trim().max(120).optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(30).default([]),
  seoTitle: z.string().trim().max(160).optional().nullable(),
  seoDescription: z.string().trim().max(320).optional().nullable(),
  images: z.array(productImageInputSchema).max(12).default([]),
  variants: z.array(variantInputSchema).max(120).default([]),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export const collectionRuleSchema = z.object({
  field: z.enum(["tag", "price", "category", "vendor", "inventory", "title"]),
  operator: z.enum([
    "equals", "not_equals", "contains", "not_contains",
    "greater_than", "less_than", "starts_with",
  ]),
  value: z.string().trim().max(120),
});

export const collectionInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().max(1000).optional().nullable(),
  type: z.enum(["MANUAL", "AUTOMATIC"]).default("MANUAL"),
  match: z.enum(["all", "any"]).default("all"),
  rules: z.array(collectionRuleSchema).max(10).default([]),
  productIds: z.array(z.string()).default([]),
  visible: z.boolean().default(true),
  seoTitle: z.string().trim().max(160).optional().nullable(),
  seoDescription: z.string().trim().max(320).optional().nullable(),
});

export type CollectionInput = z.infer<typeof collectionInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const productListParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: productStatusSchema.optional(),
  categoryId: z.string().optional(),
  collectionId: z.string().optional(),
  vendor: z.string().optional(),
  tag: z.string().optional(),
  stock: z.enum(["in", "low", "out"]).optional(),
  sort: z
    .enum(["updated", "title", "price_asc", "price_desc", "inventory", "revenue", "created"])
    .default("updated"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type ProductListParams = z.infer<typeof productListParamsSchema>;
