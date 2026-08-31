import { z } from "zod";

const money = z.coerce.number().min(0).max(1_000_000);

export const discountInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    code: z
      .string()
      .trim()
      .max(40)
      .regex(/^[A-Za-z0-9_-]*$/, "Codes may only contain letters, numbers, hyphens and underscores")
      .optional()
      .nullable(),
    automatic: z.boolean().default(false),
    type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING", "BUY_X_GET_Y"]).default("PERCENTAGE"),
    status: z.enum(["DRAFT", "ACTIVE", "SCHEDULED", "EXPIRED", "DISABLED"]).default("DRAFT"),
    value: money.default(0),
    minPurchase: z.union([money, z.null()]).optional(),
    minQuantity: z.union([z.coerce.number().int().min(1).max(1000), z.null()]).optional(),
    usageLimit: z.union([z.coerce.number().int().min(1).max(1_000_000), z.null()]).optional(),
    oncePerCustomer: z.boolean().default(false),
    appliesToScope: z.enum(["all", "products", "collections"]).default("all"),
    productIds: z.array(z.string()).default([]),
    collectionIds: z.array(z.string()).default([]),
    buyQuantity: z.coerce.number().int().min(1).max(100).default(2),
    getQuantity: z.coerce.number().int().min(1).max(100).default(1),
    getDiscountPercent: z.coerce.number().min(1).max(100).default(100),
    startsAt: z.coerce.date().default(() => new Date()),
    endsAt: z.union([z.coerce.date(), z.null()]).optional(),
  })
  .refine((data) => data.automatic || (data.code && data.code.length > 0), {
    message: "Add a discount code, or mark the discount automatic",
    path: ["code"],
  })
  .refine((data) => data.type !== "PERCENTAGE" || (data.value > 0 && data.value <= 100), {
    message: "Percentage must be between 1 and 100",
    path: ["value"],
  })
  .refine((data) => data.type !== "FIXED_AMOUNT" || data.value > 0, {
    message: "Enter an amount greater than zero",
    path: ["value"],
  })
  .refine((data) => !data.endsAt || data.endsAt > data.startsAt, {
    message: "The end date must be after the start date",
    path: ["endsAt"],
  });

export type DiscountInput = z.infer<typeof discountInputSchema>;

export const addressSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  line1: z.string().trim().min(1, "Address is required").max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1, "City is required").max(120),
  region: z.string().trim().min(1, "State or region is required").max(120),
  postalCode: z.string().trim().min(1, "Postal code is required").max(20),
  country: z.string().trim().min(2).max(2).default("US"),
  phone: z.string().trim().max(40).optional().nullable(),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  shippingAddress: addressSchema,
  billingSameAsShipping: z.boolean().default(true),
  billingAddress: addressSchema.optional().nullable(),
  discountCode: z.string().trim().max(40).optional().nullable(),
  acceptsMarketing: z.boolean().default(false),
  note: z.string().trim().max(500).optional().nullable(),
});

export const customerInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(254).toLowerCase(),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  acceptsMarketing: z.boolean().default(false),
});

export const orderListParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "REFUNDED", "PARTIALLY_REFUNDED", "FAILED"]).optional(),
  fulfillmentStatus: z.enum(["UNFULFILLED", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED"]).optional(),
  customerId: z.string().optional(),
  sort: z.enum(["newest", "oldest", "total_desc", "total_asc"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export const customerListParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  tag: z.string().optional(),
  sort: z.enum(["newest", "name", "spent_desc", "orders_desc"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
