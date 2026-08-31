import "server-only";
import { prisma, type Prisma, type ProductStatus } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { toNumber } from "@/lib/money";
import {
  audit, authorize, NotFoundError, uniqueStoreSlug, ValidationError, type ServiceContext,
} from "@/lib/services/context";
import {
  productInputSchema, productListParamsSchema,
  type ProductListParams,
} from "@/lib/validation/catalog";
import { parseProvided } from "@/lib/validation/partial";

export type ProductRow = {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  inventory: number;
  trackInventory: boolean;
  variantCount: number;
  categoryName: string | null;
  vendor: string | null;
  tags: string[];
  updatedAt: Date;
  unitsSold: number;
  revenue: number;
  isDemo: boolean;
};

export type ProductListResult = {
  rows: ProductRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

function buildWhere(storeId: string, params: ProductListParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { storeId };

  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: "insensitive" } },
      { sku: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
      { vendor: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.vendor) where.vendor = params.vendor;
  if (params.tag) where.tags = { has: params.tag };
  if (params.collectionId) where.collections = { some: { collectionId: params.collectionId } };
  if (params.stock === "out") where.inventory = { lte: 0 };
  if (params.stock === "low") where.inventory = { gt: 0, lte: 10 };
  if (params.stock === "in") where.inventory = { gt: 10 };

  return where;
}

const ORDER_BY: Record<ProductListParams["sort"], Prisma.ProductOrderByWithRelationInput> = {
  updated: { updatedAt: "desc" },
  created: { createdAt: "desc" },
  title: { title: "asc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
  inventory: { inventory: "asc" },
  revenue: { updatedAt: "desc" }, // re-sorted below using sales aggregates
};

export async function listProducts(
  ctx: ServiceContext,
  rawParams: Partial<ProductListParams> = {},
): Promise<ProductListResult> {
  authorize(ctx, "catalog:read");
  const params = productListParamsSchema.parse(rawParams);
  const where = buildWhere(ctx.storeId, params);

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: ORDER_BY[params.sort],
      skip: params.sort === "revenue" ? 0 : (params.page - 1) * params.perPage,
      take: params.sort === "revenue" ? 500 : params.perPage,
      select: {
        id: true, title: true, slug: true, status: true, price: true, compareAtPrice: true,
        inventory: true, trackInventory: true, vendor: true, tags: true, updatedAt: true,
        isDemo: true,
        category: { select: { name: true } },
        images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        _count: { select: { variants: true } },
      },
    }),
  ]);

  const ids = products.map((p) => p.id);
  const sales = ids.length
    ? await prisma.orderItem.groupBy({
        by: ["productId"],
        where: { productId: { in: ids } },
        _sum: { quantity: true, total: true },
      })
    : [];
  const salesByProduct = new Map(
    sales.map((row) => [row.productId!, { units: row._sum.quantity ?? 0, revenue: toNumber(row._sum.total) }]),
  );

  let rows: ProductRow[] = products.map((product) => {
    const stats = salesByProduct.get(product.id) ?? { units: 0, revenue: 0 };
    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      status: product.status,
      imageUrl: product.images[0]?.url ?? null,
      price: toNumber(product.price),
      compareAtPrice: product.compareAtPrice ? toNumber(product.compareAtPrice) : null,
      inventory: product.inventory,
      trackInventory: product.trackInventory,
      variantCount: product._count.variants,
      categoryName: product.category?.name ?? null,
      vendor: product.vendor,
      tags: product.tags,
      updatedAt: product.updatedAt,
      unitsSold: stats.units,
      revenue: stats.revenue,
      isDemo: product.isDemo,
    };
  });

  // Revenue is an aggregate of a related table, so that sort is applied here.
  if (params.sort === "revenue") {
    rows.sort((a, b) => b.revenue - a.revenue);
    rows = rows.slice((params.page - 1) * params.perPage, params.page * params.perPage);
  }

  return {
    rows,
    total,
    page: params.page,
    perPage: params.perPage,
    pageCount: Math.max(1, Math.ceil(total / params.perPage)),
  };
}

export async function getProduct(ctx: ServiceContext, id: string) {
  authorize(ctx, "catalog:read");
  const product = await prisma.product.findFirst({
    where: { id, storeId: ctx.storeId },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" } },
      category: true,
      collections: { include: { collection: { select: { id: true, title: true } } } },
    },
  });
  if (!product) throw new NotFoundError("Product");
  return product;
}

export async function getProductStats(storeId: string, productId: string) {
  const [sales, views, reviews] = await Promise.all([
    prisma.orderItem.aggregate({
      where: { productId, order: { storeId } },
      _sum: { quantity: true, total: true },
      _count: { _all: true },
    }),
    prisma.analyticsEvent.count({ where: { storeId, productId, type: "product_view" } }),
    prisma.review.aggregate({
      where: { productId, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);
  return {
    unitsSold: sales._sum.quantity ?? 0,
    revenue: toNumber(sales._sum.total),
    orderCount: sales._count._all,
    productViews: views,
    averageRating: reviews._avg.rating ?? null,
    reviewCount: reviews._count._all,
  };
}

function variantTitle(options: Record<string, string>, fallback: string) {
  const values = Object.values(options).filter(Boolean);
  return values.length ? values.join(" / ") : fallback;
}

export async function createProduct(ctx: ServiceContext, raw: unknown) {
  authorize(ctx, "catalog:write");
  const input = productInputSchema.parse(raw);
  const slug = await uniqueStoreSlug("product", ctx.storeId, input.slug || slugify(input.title));

  const totalVariantInventory = input.variants.reduce((sum, v) => sum + v.inventory, 0);

  const product = await prisma.product.create({
    data: {
      storeId: ctx.storeId,
      title: input.title,
      slug,
      description: input.description ?? null,
      status: input.status,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      cost: input.cost ?? null,
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
      trackInventory: input.trackInventory,
      inventory: input.variants.length ? totalVariantInventory : input.inventory,
      categoryId: input.categoryId || null,
      vendor: input.vendor ?? null,
      tags: input.tags,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      images: {
        create: input.images.map((image, index) => ({
          url: image.url,
          alt: image.alt ?? null,
          position: index,
        })),
      },
      variants: {
        create: input.variants.map((variant, index) => ({
          title: variantTitle(variant.options, variant.title),
          options: variant.options,
          sku: variant.sku ?? null,
          price: variant.price ?? null,
          inventory: variant.inventory,
          imageUrl: variant.imageUrl ?? null,
          position: index,
        })),
      },
      collections: {
        create: input.collectionIds.map((collectionId, index) => ({ collectionId, position: index })),
      },
    },
    include: { images: true, variants: true },
  });

  await audit(ctx, "product.create", { type: "Product", id: product.id }, { title: product.title });
  return product;
}

export async function updateProduct(ctx: ServiceContext, id: string, raw: unknown) {
  authorize(ctx, "catalog:write");
  const existing = await prisma.product.findFirst({
    where: { id, storeId: ctx.storeId },
    include: { variants: true, images: true },
  });
  if (!existing) throw new NotFoundError("Product");

  const input = parseProvided(productInputSchema, raw);

  const slug =
    input.slug !== undefined || input.title !== undefined
      ? await uniqueStoreSlug(
          "product",
          ctx.storeId,
          input.slug || slugify(input.title ?? existing.title),
          id,
        )
      : undefined;

  const data: Prisma.ProductUpdateInput = {
    ...(input.title !== undefined && { title: input.title }),
    ...(slug !== undefined && { slug }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.price !== undefined && { price: input.price }),
    ...(input.compareAtPrice !== undefined && { compareAtPrice: input.compareAtPrice }),
    ...(input.cost !== undefined && { cost: input.cost }),
    ...(input.sku !== undefined && { sku: input.sku }),
    ...(input.barcode !== undefined && { barcode: input.barcode }),
    ...(input.trackInventory !== undefined && { trackInventory: input.trackInventory }),
    ...(input.vendor !== undefined && { vendor: input.vendor }),
    ...(input.tags !== undefined && { tags: input.tags }),
    ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
    ...(input.seoDescription !== undefined && { seoDescription: input.seoDescription }),
    ...(input.categoryId !== undefined && {
      category: input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true },
    }),
  };

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data });

    if (input.images) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (input.images.length) {
        await tx.productImage.createMany({
          data: input.images.map((image, index) => ({
            productId: id, url: image.url, alt: image.alt ?? null, position: index,
          })),
        });
      }
    }

    if (input.variants) {
      const keptIds = input.variants.map((v) => v.id).filter(Boolean) as string[];
      await tx.productVariant.deleteMany({
        where: { productId: id, ...(keptIds.length ? { id: { notIn: keptIds } } : {}) },
      });
      for (const [index, variant] of input.variants.entries()) {
        const payload = {
          title: variantTitle(variant.options, variant.title),
          options: variant.options,
          sku: variant.sku ?? null,
          price: variant.price ?? null,
          inventory: variant.inventory,
          imageUrl: variant.imageUrl ?? null,
          position: index,
        };
        if (variant.id && existing.variants.some((v) => v.id === variant.id)) {
          await tx.productVariant.update({ where: { id: variant.id }, data: payload });
        } else {
          await tx.productVariant.create({ data: { productId: id, ...payload } });
        }
      }
    }

    if (input.collectionIds) {
      await tx.collectionProduct.deleteMany({ where: { productId: id } });
      if (input.collectionIds.length) {
        await tx.collectionProduct.createMany({
          data: input.collectionIds.map((collectionId, index) => ({
            collectionId, productId: id, position: index,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Inventory on a product with variants is always the sum of its variants.
    const variants = await tx.productVariant.findMany({ where: { productId: id }, select: { inventory: true } });
    const inventory = variants.length
      ? variants.reduce((sum, v) => sum + v.inventory, 0)
      : input.inventory !== undefined
        ? input.inventory
        : existing.inventory;
    await tx.product.update({ where: { id }, data: { inventory } });
  });

  await audit(ctx, "product.update", { type: "Product", id }, { fields: Object.keys(input) });
  return getProduct(ctx, id);
}

export async function setProductStatus(ctx: ServiceContext, ids: string[], status: ProductStatus) {
  authorize(ctx, "catalog:write");
  const result = await prisma.product.updateMany({
    where: { id: { in: ids }, storeId: ctx.storeId },
    data: { status },
  });
  await audit(ctx, `product.status.${status.toLowerCase()}`, undefined, { ids, count: result.count });
  return result.count;
}

export async function duplicateProduct(ctx: ServiceContext, id: string) {
  authorize(ctx, "catalog:write");
  const source = await getProduct(ctx, id);
  const slug = await uniqueStoreSlug("product", ctx.storeId, `${source.slug}-copy`);

  const copy = await prisma.product.create({
    data: {
      storeId: ctx.storeId,
      title: `${source.title} (copy)`,
      slug,
      description: source.description,
      status: "DRAFT",
      price: source.price,
      compareAtPrice: source.compareAtPrice,
      cost: source.cost,
      sku: source.sku ? `${source.sku}-COPY` : null,
      barcode: source.barcode,
      trackInventory: source.trackInventory,
      inventory: source.inventory,
      categoryId: source.categoryId,
      vendor: source.vendor,
      tags: source.tags,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      images: {
        create: source.images.map((image) => ({ url: image.url, alt: image.alt, position: image.position })),
      },
      variants: {
        create: source.variants.map((variant) => ({
          title: variant.title,
          options: variant.options as Prisma.InputJsonValue,
          sku: variant.sku ? `${variant.sku}-COPY` : null,
          price: variant.price,
          inventory: variant.inventory,
          imageUrl: variant.imageUrl,
          position: variant.position,
        })),
      },
    },
  });

  await audit(ctx, "product.duplicate", { type: "Product", id: copy.id }, { sourceId: id });
  return copy;
}

export async function deleteProducts(ctx: ServiceContext, ids: string[]) {
  authorize(ctx, "catalog:write");
  const result = await prisma.product.deleteMany({ where: { id: { in: ids }, storeId: ctx.storeId } });
  await audit(ctx, "product.delete", undefined, { ids, count: result.count });
  return result.count;
}

/** Distinct vendors and tags, for filter menus. */
export async function getCatalogFacets(storeId: string) {
  const [vendors, tagRows, categories] = await Promise.all([
    prisma.product.findMany({
      where: { storeId, vendor: { not: null } },
      distinct: ["vendor"],
      select: { vendor: true },
      orderBy: { vendor: "asc" },
    }),
    prisma.product.findMany({ where: { storeId }, select: { tags: true } }),
    prisma.category.findMany({ where: { storeId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const tags = [...new Set(tagRows.flatMap((row) => row.tags))].sort();
  return {
    vendors: vendors.map((row) => row.vendor!).filter(Boolean),
    tags,
    categories,
  };
}

/**
 * Claims stock for a purchased line, refusing the sale when there is not enough.
 *
 * Reading the level and then writing `max(0, level - quantity)` both oversells
 * and hides it: concurrent orders each read the same level, each write a
 * non-negative result, and every one of them succeeds. The conditional update
 * makes the database the arbiter, so exactly as many orders succeed as there
 * were units.
 *
 * The variant is the authoritative counter when a line has one; `Product.inventory`
 * is a rollup of its variants, so it is decremented best-effort rather than
 * enforced — drift between the two should not block a sale the variant allows.
 */
export async function decrementInventory(
  tx: Prisma.TransactionClient,
  items: Array<{ productId: string; variantId: string | null; quantity: number }>,
) {
  for (const item of items) {
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { title: true, trackInventory: true },
    });
    if (!product?.trackInventory) continue;

    const soldOut = () =>
      new ValidationError(`${product.title} does not have enough stock left.`);

    if (item.variantId) {
      const claimed = await tx.productVariant.updateMany({
        where: { id: item.variantId, inventory: { gte: item.quantity } },
        data: { inventory: { decrement: item.quantity } },
      });
      if (claimed.count === 0) throw soldOut();

      // Keep the product-level rollup aligned, clamped so it cannot go negative.
      await tx.product.updateMany({
        where: { id: item.productId, inventory: { gte: item.quantity } },
        data: { inventory: { decrement: item.quantity } },
      });
      continue;
    }

    const claimed = await tx.product.updateMany({
      where: { id: item.productId, inventory: { gte: item.quantity } },
      data: { inventory: { decrement: item.quantity } },
    });
    if (claimed.count === 0) throw soldOut();
  }
}
