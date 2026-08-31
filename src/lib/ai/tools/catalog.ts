import { z } from "zod";
import { prisma } from "@/lib/db";
import { defineTool } from "@/lib/ai/types";
import { formatMoney, round2, toNumber } from "@/lib/money";
import {
  createProduct, deleteProducts, getProduct, setProductStatus, updateProduct,
} from "@/lib/services/products";
import {
  addProductsToCollection, createCollection, deleteCollection, updateCollection,
} from "@/lib/services/collections";
import { createCategory } from "@/lib/services/categories";

export const catalogTools = [
  defineTool({
    name: "create_product",
    description:
      "Create a product. Created as a draft unless the caller explicitly asks for it to be live. Report clearly what is still missing (images, description, inventory, variants).",
    schema: z.object({
      title: z.string().min(1).max(160),
      price: z.number().min(0).max(1_000_000),
      description: z.string().max(4000).optional(),
      compareAtPrice: z.number().min(0).optional(),
      cost: z.number().min(0).optional(),
      sku: z.string().max(60).optional(),
      inventory: z.number().int().min(0).default(0),
      vendor: z.string().max(120).optional(),
      tags: z.array(z.string().max(40)).max(20).default([]),
      categoryName: z.string().max(80).optional().describe("Existing category name; created if missing"),
      status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
      /** Option axes, e.g. [{ name: "Size", values: ["S","M","L"] }] */
      options: z
        .array(z.object({ name: z.string().max(40), values: z.array(z.string().max(40)).min(1).max(24) }))
        .max(3)
        .default([]),
    }),
    risk: "low",
    capability: "catalog:write",
    async execute(input, ctx) {
      let categoryId: string | null = null;
      if (input.categoryName) {
        const existing = await prisma.category.findFirst({
          where: { storeId: ctx.storeId, name: { equals: input.categoryName, mode: "insensitive" } },
        });
        categoryId = existing?.id ?? (await createCategory(ctx, { name: input.categoryName })).id;
      }

      let combos: Array<Record<string, string>> = [];
      if (input.options.length) {
        combos = [{}];
        for (const axis of input.options) {
          combos = combos.flatMap((combo) => axis.values.map((value) => ({ ...combo, [axis.name]: value })));
        }
      }

      const product = await createProduct(ctx, {
        title: input.title,
        description: input.description ?? null,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        cost: input.cost ?? null,
        sku: input.sku ?? null,
        inventory: input.inventory,
        vendor: input.vendor ?? null,
        tags: input.tags,
        categoryId,
        status: input.status,
        variants: combos.map((options) => ({
          title: Object.values(options).join(" / "),
          options,
          inventory: 0,
        })),
      });

      const missing: string[] = [];
      if (!input.description) missing.push("a description");
      missing.push("images");
      if (combos.length) missing.push("per-variant inventory");
      else if (!input.inventory) missing.push("inventory");

      return {
        summary:
          `Created ${product.title} at ${formatMoney(input.price)} as a ${input.status.toLowerCase()}` +
          (combos.length ? ` with ${combos.length} variants.` : ".") +
          (missing.length ? ` It still needs ${missing.join(", ")}.` : ""),
        data: { productId: product.id, slug: product.slug, status: product.status, variantCount: combos.length },
        links: [{ label: `Edit ${product.title}`, href: `/admin/products/${product.id}` }],
        undo: { tool: "delete_products", params: { productIds: [product.id] } },
      };
    },
  }),

  defineTool({
    name: "update_product",
    description:
      "Update fields on an existing product. Only the fields you pass are changed. Use get_product first if you need the current values.",
    schema: z.object({
      productId: z.string(),
      title: z.string().max(160).optional(),
      description: z.string().max(8000).optional(),
      price: z.number().min(0).optional(),
      compareAtPrice: z.number().min(0).nullable().optional(),
      inventory: z.number().int().min(0).optional(),
      tags: z.array(z.string().max(40)).max(30).optional(),
      vendor: z.string().max(120).optional(),
      seoTitle: z.string().max(160).optional(),
      seoDescription: z.string().max(320).optional(),
      status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    }),
    risk: "low",
    capability: "catalog:write",
    async escalate(input, ctx) {
      // Editing a draft is routine; repricing a live product is not.
      if (input.price === undefined) return false;
      const product = await getProduct(ctx, input.productId);
      return product.status === "ACTIVE" && toNumber(product.price) !== input.price;
    },
    async confirm(input, ctx) {
      const product = await getProduct(ctx, input.productId);
      return {
        title: `Change the price of ${product.title}?`,
        description: "This product is live, so the new price applies to your storefront immediately.",
        details: [
          `Current price: ${formatMoney(toNumber(product.price))}`,
          `New price: ${formatMoney(input.price ?? 0)}`,
        ],
        confirmLabel: "Change price",
      };
    },
    async execute(input, ctx) {
      const { productId, ...fields } = input;
      const before = await getProduct(ctx, productId);
      const provided = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
      );
      const product = await updateProduct(ctx, productId, provided);

      const changed = Object.keys(provided);
      return {
        summary: `Updated ${changed.join(", ")} on ${product.title}.`,
        data: { productId, changed },
        links: [{ label: `Open ${product.title}`, href: `/admin/products/${productId}` }],
        undo: {
          tool: "update_product",
          params: {
            productId,
            ...Object.fromEntries(
              changed.map((key) => [
                key,
                key === "price" || key === "compareAtPrice"
                  ? toNumber(before[key as "price"] as never)
                  : (before as unknown as Record<string, unknown>)[key],
              ]),
            ),
          },
        },
      };
    },
  }),

  defineTool({
    name: "add_product_variants",
    description:
      "Add or replace the variant matrix on a product, for example sizes S through XXL. Existing variants with matching options keep their inventory.",
    schema: z.object({
      productId: z.string(),
      options: z
        .array(z.object({ name: z.string().max(40), values: z.array(z.string().max(40)).min(1).max(24) }))
        .min(1)
        .max(3),
      inventoryPerVariant: z.number().int().min(0).max(100000).default(0),
    }),
    risk: "low",
    capability: "catalog:write",
    async execute(input, ctx) {
      const product = await getProduct(ctx, input.productId);

      let combos: Array<Record<string, string>> = [{}];
      for (const axis of input.options) {
        combos = combos.flatMap((combo) => axis.values.map((value) => ({ ...combo, [axis.name]: value })));
      }

      const existingByKey = new Map(
        product.variants.map((variant) => [JSON.stringify(variant.options), variant]),
      );

      const variants = combos.map((options) => {
        const existing = existingByKey.get(JSON.stringify(options));
        return {
          id: existing?.id,
          title: Object.values(options).join(" / "),
          options,
          inventory: existing?.inventory ?? input.inventoryPerVariant,
          price: existing?.price ? toNumber(existing.price) : null,
          sku: existing?.sku ?? null,
        };
      });

      await updateProduct(ctx, input.productId, { variants });

      return {
        summary: `${product.title} now has ${variants.length} variants (${input.options.map((axis) => `${axis.name}: ${axis.values.join(", ")}`).join("; ")}).`,
        data: { productId: input.productId, variantCount: variants.length },
        links: [{ label: `Open ${product.title}`, href: `/admin/products/${input.productId}` }],
      };
    },
  }),

  defineTool({
    name: "set_product_status",
    description:
      "Publish, unpublish or archive products. Publishing makes them purchasable on the storefront.",
    schema: z.object({
      productIds: z.array(z.string()).min(1).max(200),
      status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    }),
    risk: "high",
    capability: "catalog:write",
    async confirm(input, ctx) {
      const products = await prisma.product.findMany({
        where: { id: { in: input.productIds }, storeId: ctx.storeId },
        select: { title: true, status: true },
      });
      const verb = input.status === "ACTIVE" ? "publish" : input.status === "DRAFT" ? "unpublish" : "archive";
      return {
        title: `${verb[0].toUpperCase()}${verb.slice(1)} ${products.length} product${products.length === 1 ? "" : "s"}?`,
        description:
          input.status === "ACTIVE"
            ? "These products become visible and purchasable on your live storefront."
            : "These products are removed from your live storefront. Existing orders are unaffected.",
        details: products.slice(0, 10).map((product) => `${product.title} (currently ${product.status.toLowerCase()})`),
        confirmLabel: `${verb[0].toUpperCase()}${verb.slice(1)}`,
        destructive: input.status !== "ACTIVE",
      };
    },
    async execute(input, ctx) {
      const before = await prisma.product.findMany({
        where: { id: { in: input.productIds }, storeId: ctx.storeId },
        select: { id: true, status: true },
      });
      const count = await setProductStatus(ctx, input.productIds, input.status);

      return {
        summary: `${count} product${count === 1 ? "" : "s"} set to ${input.status.toLowerCase()}.`,
        data: { count },
        links: [{ label: "Products", href: "/admin/products" }],
        undo: {
          tool: "restore_product_statuses",
          params: { entries: before.map((row) => ({ id: row.id, status: row.status })) },
        },
      };
    },
  }),

  defineTool({
    name: "restore_product_statuses",
    description: "Internal: restores previous product statuses. Used to undo a status change.",
    schema: z.object({
      entries: z.array(z.object({ id: z.string(), status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]) })),
    }),
    risk: "low",
    capability: "catalog:write",
    async execute(input, ctx) {
      for (const entry of input.entries) {
        await setProductStatus(ctx, [entry.id], entry.status);
      }
      return { summary: `Restored ${input.entries.length} product statuses.`, data: { count: input.entries.length } };
    },
  }),

  defineTool({
    name: "adjust_prices",
    description:
      "Change prices across many products at once, by percentage or fixed amount. Always confirmed because it affects the live store.",
    schema: z.object({
      scope: z.enum(["all", "collection", "products"]).default("all"),
      collectionId: z.string().optional(),
      productIds: z.array(z.string()).max(500).optional(),
      changeType: z.enum(["percent", "amount", "set"]),
      value: z.number().describe("Negative reduces the price; positive increases it"),
      /** When true, the old price is written to compareAtPrice so the discount is visible. */
      showAsSale: z.boolean().default(false),
    }),
    risk: "high",
    capability: "catalog:write",
    async confirm(input, ctx) {
      const targets = await resolvePriceTargets(input, ctx.storeId);
      const direction = input.changeType === "set" ? "set to" : input.value < 0 ? "reduced by" : "increased by";
      const magnitude =
        input.changeType === "percent"
          ? `${Math.abs(input.value)}%`
          : formatMoney(Math.abs(input.value));

      return {
        title: `Change prices on ${targets.length} product${targets.length === 1 ? "" : "s"}?`,
        description: `Prices will be ${direction} ${magnitude}. This affects your live storefront immediately.`,
        details: [
          ...targets.slice(0, 6).map((product) => {
            const next = computeNewPrice(toNumber(product.price), input.changeType, input.value);
            return `${product.title}: ${formatMoney(toNumber(product.price))} → ${formatMoney(next)}`;
          }),
          ...(targets.length > 6 ? [`…and ${targets.length - 6} more`] : []),
        ],
        confirmLabel: "Change prices",
        destructive: true,
      };
    },
    async execute(input, ctx) {
      const targets = await resolvePriceTargets(input, ctx.storeId);
      const before: Array<{ productId: string; price: number; compareAtPrice: number | null }> = [];

      for (const product of targets) {
        const current = toNumber(product.price);
        before.push({
          productId: product.id,
          price: current,
          compareAtPrice: product.compareAtPrice ? toNumber(product.compareAtPrice) : null,
        });
        const next = computeNewPrice(current, input.changeType, input.value);
        await updateProduct(ctx, product.id, {
          price: next,
          ...(input.showAsSale && next < current ? { compareAtPrice: current } : {}),
        });
      }

      return {
        summary: `Updated prices on ${targets.length} product${targets.length === 1 ? "" : "s"}.`,
        data: { count: targets.length },
        links: [{ label: "Products", href: "/admin/products" }],
        undo: { tool: "restore_prices", params: { entries: before } },
      };
    },
  }),

  defineTool({
    name: "restore_prices",
    description: "Internal: restores previous prices. Used to undo a bulk price change.",
    schema: z.object({
      entries: z.array(
        z.object({
          productId: z.string(),
          price: z.number(),
          compareAtPrice: z.number().nullable(),
        }),
      ),
    }),
    risk: "low",
    capability: "catalog:write",
    async execute(input, ctx) {
      for (const entry of input.entries) {
        await updateProduct(ctx, entry.productId, {
          price: entry.price,
          compareAtPrice: entry.compareAtPrice,
        });
      }
      return { summary: `Restored ${input.entries.length} prices.`, data: { count: input.entries.length } };
    },
  }),

  defineTool({
    name: "delete_products",
    description: "Permanently delete products. Prefer archiving unless the caller is explicit.",
    schema: z.object({ productIds: z.array(z.string()).min(1).max(100) }),
    risk: "high",
    capability: "catalog:write",
    async confirm(input, ctx) {
      const products = await prisma.product.findMany({
        where: { id: { in: input.productIds }, storeId: ctx.storeId },
        select: { title: true, _count: { select: { orderItems: true } } },
      });
      const withOrders = products.filter((product) => product._count.orderItems > 0);
      return {
        title: `Permanently delete ${products.length} product${products.length === 1 ? "" : "s"}?`,
        description:
          "This cannot be undone. Past order line items keep their recorded title and price, but the products, their variants and images are removed.",
        details: [
          ...products.slice(0, 8).map((product) => product.title),
          ...(withOrders.length
            ? [`${withOrders.length} of these have sales history. Archiving keeps that history intact.`]
            : []),
        ],
        confirmLabel: "Delete permanently",
        destructive: true,
      };
    },
    async execute(input, ctx) {
      const count = await deleteProducts(ctx, input.productIds);
      return {
        summary: `Deleted ${count} product${count === 1 ? "" : "s"}.`,
        data: { count },
      };
    },
  }),

  defineTool({
    name: "create_collection",
    description:
      "Create a collection. Manual collections take an explicit product list; rule-based ones match products automatically.",
    schema: z.object({
      title: z.string().min(1).max(120),
      description: z.string().max(2000).optional(),
      type: z.enum(["MANUAL", "AUTOMATIC"]).default("MANUAL"),
      productIds: z.array(z.string()).max(200).default([]),
      match: z.enum(["all", "any"]).default("all"),
      rules: z
        .array(
          z.object({
            field: z.enum(["tag", "price", "category", "vendor", "inventory", "title"]),
            operator: z.enum([
              "equals", "not_equals", "contains", "not_contains",
              "greater_than", "less_than", "starts_with",
            ]),
            value: z.string().max(120),
          }),
        )
        .max(8)
        .default([]),
      visible: z.boolean().default(true),
    }),
    risk: "low",
    capability: "catalog:write",
    async execute(input, ctx) {
      const collection = await createCollection(ctx, input);
      return {
        summary:
          input.type === "AUTOMATIC"
            ? `Created the rule-based collection ${collection.title}. Matching products are included automatically.`
            : `Created ${collection.title} with ${input.productIds.length} product${input.productIds.length === 1 ? "" : "s"}.`,
        data: { collectionId: collection.id, slug: collection.slug },
        links: [{ label: `Edit ${collection.title}`, href: `/admin/collections/${collection.id}` }],
        undo: { tool: "delete_collection", params: { collectionId: collection.id } },
      };
    },
  }),

  defineTool({
    name: "add_products_to_collection",
    description: "Add existing products to a manual collection.",
    schema: z.object({
      collectionId: z.string(),
      productIds: z.array(z.string()).min(1).max(200),
    }),
    risk: "low",
    capability: "catalog:write",
    async execute(input, ctx) {
      const count = await addProductsToCollection(ctx, input.collectionId, input.productIds);
      const collection = await prisma.collection.findUniqueOrThrow({ where: { id: input.collectionId } });
      return {
        summary: `Added ${count} product${count === 1 ? "" : "s"} to ${collection.title}.`,
        data: { count },
        links: [{ label: collection.title, href: `/admin/collections/${collection.id}` }],
      };
    },
  }),

  defineTool({
    name: "update_collection",
    description: "Change a collection's title, description, visibility or rules.",
    schema: z.object({
      collectionId: z.string(),
      title: z.string().max(120).optional(),
      description: z.string().max(2000).optional(),
      visible: z.boolean().optional(),
    }),
    risk: "low",
    capability: "catalog:write",
    async execute(input, ctx) {
      const { collectionId, ...fields } = input;
      const provided = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      const collection = await updateCollection(ctx, collectionId, provided);
      return {
        summary: `Updated ${collection.title}.`,
        data: { collectionId, changed: Object.keys(provided) },
        links: [{ label: collection.title, href: `/admin/collections/${collectionId}` }],
      };
    },
  }),

  defineTool({
    name: "delete_collection",
    description: "Delete a collection. Products themselves are not deleted.",
    schema: z.object({ collectionId: z.string() }),
    risk: "high",
    capability: "catalog:write",
    async confirm(input, ctx) {
      const collection = await prisma.collection.findFirst({
        where: { id: input.collectionId, storeId: ctx.storeId },
        select: { title: true, _count: { select: { products: true } } },
      });
      return {
        title: `Delete the collection ${collection?.title ?? ""}?`,
        description:
          "The products stay in your catalog. Any storefront section pointing at this collection falls back to newest products.",
        details: [`${collection?._count.products ?? 0} products are currently linked.`],
        confirmLabel: "Delete collection",
        destructive: true,
      };
    },
    async execute(input, ctx) {
      await deleteCollection(ctx, input.collectionId);
      return { summary: "Collection deleted.", data: { collectionId: input.collectionId } };
    },
  }),

  defineTool({
    name: "set_inventory",
    description: "Set the stock quantity for a product or one of its variants.",
    schema: z.object({
      productId: z.string(),
      variantId: z.string().optional(),
      quantity: z.number().int().min(0).max(1_000_000),
    }),
    risk: "low",
    capability: "catalog:write",
    async execute(input, ctx) {
      const product = await getProduct(ctx, input.productId);

      if (input.variantId) {
        const variant = product.variants.find((v) => v.id === input.variantId);
        if (!variant) throw new Error("That variant does not belong to this product.");
        await updateProduct(ctx, input.productId, {
          variants: product.variants.map((v) => ({
            id: v.id,
            title: v.title,
            options: v.options as Record<string, string>,
            sku: v.sku,
            price: v.price ? toNumber(v.price) : null,
            inventory: v.id === input.variantId ? input.quantity : v.inventory,
            imageUrl: v.imageUrl,
          })),
        });
        return {
          summary: `${product.title} — ${variant.title} set to ${input.quantity} units.`,
          data: { productId: input.productId, variantId: input.variantId, quantity: input.quantity },
          undo: {
            tool: "set_inventory",
            params: { productId: input.productId, variantId: input.variantId, quantity: variant.inventory },
          },
        };
      }

      await updateProduct(ctx, input.productId, { inventory: input.quantity });
      return {
        summary: `${product.title} set to ${input.quantity} units.`,
        data: { productId: input.productId, quantity: input.quantity },
        undo: { tool: "set_inventory", params: { productId: input.productId, quantity: product.inventory } },
      };
    },
  }),
];

async function resolvePriceTargets(
  input: { scope: string; collectionId?: string; productIds?: string[] },
  storeId: string,
) {
  if (input.scope === "products" && input.productIds?.length) {
    return prisma.product.findMany({
      where: { id: { in: input.productIds }, storeId },
      select: { id: true, title: true, price: true, compareAtPrice: true },
    });
  }
  if (input.scope === "collection" && input.collectionId) {
    const links = await prisma.collectionProduct.findMany({
      where: { collectionId: input.collectionId, collection: { storeId } },
      select: { productId: true },
    });
    return prisma.product.findMany({
      where: { id: { in: links.map((link) => link.productId) }, storeId },
      select: { id: true, title: true, price: true, compareAtPrice: true },
    });
  }
  return prisma.product.findMany({
    where: { storeId, status: { not: "ARCHIVED" } },
    select: { id: true, title: true, price: true, compareAtPrice: true },
  });
}

function computeNewPrice(current: number, changeType: string, value: number) {
  if (changeType === "set") return round2(Math.max(0, value));
  if (changeType === "percent") return round2(Math.max(0, current * (1 + value / 100)));
  return round2(Math.max(0, current + value));
}
