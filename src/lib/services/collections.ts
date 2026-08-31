import "server-only";
import { prisma, type Prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { toNumber } from "@/lib/money";
import { audit, authorize, NotFoundError, uniqueStoreSlug, type ServiceContext } from "@/lib/services/context";
import { collectionInputSchema } from "@/lib/validation/catalog";
import { parseProvided } from "@/lib/validation/partial";

export type CollectionRule = {
  field: "tag" | "price" | "category" | "vendor" | "inventory" | "title";
  operator:
    | "equals" | "not_equals" | "contains" | "not_contains"
    | "greater_than" | "less_than" | "starts_with";
  value: string;
};

export type CollectionRules = { match: "all" | "any"; rules: CollectionRule[] };

export function parseRules(value: unknown): CollectionRules {
  const raw = (value ?? {}) as Partial<CollectionRules>;
  return {
    match: raw.match === "any" ? "any" : "all",
    rules: Array.isArray(raw.rules) ? (raw.rules as CollectionRule[]) : [],
  };
}

/**
 * Translates one rule into a Prisma predicate. Automatic collections are
 * evaluated live against the catalog, so adding a matching product makes it
 * appear on the storefront without a rebuild.
 */
function ruleToWhere(rule: CollectionRule): Prisma.ProductWhereInput | null {
  const { field, operator, value } = rule;
  if (!value.trim() && field !== "inventory" && field !== "price") return null;

  if (field === "tag") {
    const tag = value.trim().toLowerCase();
    switch (operator) {
      case "equals":
      case "contains":
        return { tags: { has: tag } };
      case "not_equals":
      case "not_contains":
        return { NOT: { tags: { has: tag } } };
      default:
        return { tags: { has: tag } };
    }
  }

  if (field === "price" || field === "inventory") {
    const number = Number.parseFloat(value);
    if (!Number.isFinite(number)) return null;
    const key = field === "price" ? "price" : "inventory";
    switch (operator) {
      case "greater_than":
        return { [key]: { gt: number } } as Prisma.ProductWhereInput;
      case "less_than":
        return { [key]: { lt: number } } as Prisma.ProductWhereInput;
      case "not_equals":
        return { NOT: { [key]: number } } as Prisma.ProductWhereInput;
      default:
        return { [key]: number } as Prisma.ProductWhereInput;
    }
  }

  if (field === "category") {
    switch (operator) {
      case "not_equals":
        return { NOT: { category: { OR: [{ name: { equals: value, mode: "insensitive" } }, { slug: slugify(value) }] } } };
      default:
        return { category: { OR: [{ name: { equals: value, mode: "insensitive" } }, { slug: slugify(value) }] } };
    }
  }

  const column = field === "vendor" ? "vendor" : "title";
  switch (operator) {
    case "equals":
      return { [column]: { equals: value, mode: "insensitive" } } as Prisma.ProductWhereInput;
    case "not_equals":
      return { NOT: { [column]: { equals: value, mode: "insensitive" } } } as Prisma.ProductWhereInput;
    case "contains":
      return { [column]: { contains: value, mode: "insensitive" } } as Prisma.ProductWhereInput;
    case "not_contains":
      return { NOT: { [column]: { contains: value, mode: "insensitive" } } } as Prisma.ProductWhereInput;
    case "starts_with":
      return { [column]: { startsWith: value, mode: "insensitive" } } as Prisma.ProductWhereInput;
    default:
      return null;
  }
}

export function rulesToWhere(storeId: string, rules: CollectionRules): Prisma.ProductWhereInput {
  const predicates = rules.rules.map(ruleToWhere).filter(Boolean) as Prisma.ProductWhereInput[];
  if (!predicates.length) return { storeId, id: "__none__" };
  return rules.match === "any"
    ? { storeId, OR: predicates }
    : { storeId, AND: predicates };
}

/** Products currently in a collection, whether manual or rule-based. */
export async function getCollectionProducts(
  storeId: string,
  collection: { id: string; type: string; rules: unknown },
  options: { onlyActive?: boolean; limit?: number } = {},
) {
  const activeFilter = options.onlyActive ? { status: "ACTIVE" as const } : {};

  if (collection.type === "AUTOMATIC") {
    const where = rulesToWhere(storeId, parseRules(collection.rules));
    return prisma.product.findMany({
      where: { ...where, ...activeFilter },
      orderBy: { createdAt: "desc" },
      take: options.limit,
      include: { images: { orderBy: { position: "asc" }, take: 1 } },
    });
  }

  const links = await prisma.collectionProduct.findMany({
    where: { collectionId: collection.id, product: activeFilter },
    orderBy: { position: "asc" },
    take: options.limit,
    include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } },
  });
  return links.map((link) => link.product);
}

export async function countCollectionProducts(
  storeId: string,
  collection: { id: string; type: string; rules: unknown },
) {
  if (collection.type === "AUTOMATIC") {
    return prisma.product.count({ where: rulesToWhere(storeId, parseRules(collection.rules)) });
  }
  return prisma.collectionProduct.count({ where: { collectionId: collection.id } });
}

export async function listCollections(ctx: ServiceContext) {
  authorize(ctx, "catalog:read");
  const collections = await prisma.collection.findMany({
    where: { storeId: ctx.storeId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return Promise.all(
    collections.map(async (collection) => ({
      ...collection,
      productCount: await countCollectionProducts(ctx.storeId, collection),
    })),
  );
}

export async function getCollection(ctx: ServiceContext, id: string) {
  authorize(ctx, "catalog:read");
  const collection = await prisma.collection.findFirst({
    where: { id, storeId: ctx.storeId },
    include: {
      products: {
        orderBy: { position: "asc" },
        include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } },
      },
    },
  });
  if (!collection) throw new NotFoundError("Collection");
  return collection;
}

export async function createCollection(ctx: ServiceContext, raw: unknown) {
  authorize(ctx, "catalog:write");
  const input = collectionInputSchema.parse(raw);
  const slug = await uniqueStoreSlug("collection", ctx.storeId, input.slug || slugify(input.title));
  const maxPosition = await prisma.collection.aggregate({
    where: { storeId: ctx.storeId },
    _max: { position: true },
  });

  const collection = await prisma.collection.create({
    data: {
      storeId: ctx.storeId,
      title: input.title,
      slug,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      type: input.type,
      rules: { match: input.match, rules: input.rules } as Prisma.InputJsonValue,
      visible: input.visible,
      position: (maxPosition._max.position ?? -1) + 1,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      products:
        input.type === "MANUAL"
          ? { create: input.productIds.map((productId, index) => ({ productId, position: index })) }
          : undefined,
    },
  });

  await audit(ctx, "collection.create", { type: "Collection", id: collection.id }, { title: collection.title });
  return collection;
}

export async function updateCollection(ctx: ServiceContext, id: string, raw: unknown) {
  authorize(ctx, "catalog:write");
  const existing = await prisma.collection.findFirst({ where: { id, storeId: ctx.storeId } });
  if (!existing) throw new NotFoundError("Collection");

  const input = parseProvided(collectionInputSchema, raw);
  const slug =
    input.slug !== undefined || input.title !== undefined
      ? await uniqueStoreSlug("collection", ctx.storeId, input.slug || slugify(input.title ?? existing.title), id)
      : undefined;

  const existingRules = parseRules(existing.rules);

  await prisma.$transaction(async (tx) => {
    await tx.collection.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(slug !== undefined && { slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.visible !== undefined && { visible: input.visible }),
        ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
        ...(input.seoDescription !== undefined && { seoDescription: input.seoDescription }),
        ...((input.match !== undefined || input.rules !== undefined) && {
          rules: {
            match: input.match ?? existingRules.match,
            rules: input.rules ?? existingRules.rules,
          } as Prisma.InputJsonValue,
        }),
      },
    });

    if (input.productIds) {
      await tx.collectionProduct.deleteMany({ where: { collectionId: id } });
      if (input.productIds.length) {
        await tx.collectionProduct.createMany({
          data: input.productIds.map((productId, index) => ({ collectionId: id, productId, position: index })),
          skipDuplicates: true,
        });
      }
    }
  });

  await audit(ctx, "collection.update", { type: "Collection", id }, { fields: Object.keys(input) });
  return getCollection(ctx, id);
}

export async function addProductsToCollection(ctx: ServiceContext, id: string, productIds: string[]) {
  authorize(ctx, "catalog:write");
  const collection = await prisma.collection.findFirst({ where: { id, storeId: ctx.storeId } });
  if (!collection) throw new NotFoundError("Collection");

  // Only products in this store may be linked.
  const valid = await prisma.product.findMany({
    where: { id: { in: productIds }, storeId: ctx.storeId },
    select: { id: true },
  });
  const max = await prisma.collectionProduct.aggregate({
    where: { collectionId: id },
    _max: { position: true },
  });
  let position = (max._max.position ?? -1) + 1;

  await prisma.collectionProduct.createMany({
    data: valid.map((product) => ({ collectionId: id, productId: product.id, position: position++ })),
    skipDuplicates: true,
  });

  await audit(ctx, "collection.addProducts", { type: "Collection", id }, { count: valid.length });
  return valid.length;
}

export async function removeProductsFromCollection(ctx: ServiceContext, id: string, productIds: string[]) {
  authorize(ctx, "catalog:write");
  const result = await prisma.collectionProduct.deleteMany({
    where: { collectionId: id, productId: { in: productIds }, collection: { storeId: ctx.storeId } },
  });
  await audit(ctx, "collection.removeProducts", { type: "Collection", id }, { count: result.count });
  return result.count;
}

export async function deleteCollection(ctx: ServiceContext, id: string) {
  authorize(ctx, "catalog:write");
  const result = await prisma.collection.deleteMany({ where: { id, storeId: ctx.storeId } });
  if (!result.count) throw new NotFoundError("Collection");
  await audit(ctx, "collection.delete", { type: "Collection", id });
  return true;
}

export async function getCollectionRevenue(storeId: string, collectionId: string) {
  const links = await prisma.collectionProduct.findMany({
    where: { collectionId },
    select: { productId: true },
  });
  if (!links.length) return { revenue: 0, units: 0 };
  const aggregate = await prisma.orderItem.aggregate({
    where: { productId: { in: links.map((l) => l.productId) }, order: { storeId } },
    _sum: { total: true, quantity: true },
  });
  return { revenue: toNumber(aggregate._sum.total), units: aggregate._sum.quantity ?? 0 };
}
