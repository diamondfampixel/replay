import "server-only";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { audit, authorize, NotFoundError, uniqueStoreSlug, ValidationError, type ServiceContext } from "@/lib/services/context";
import { categoryInputSchema } from "@/lib/validation/catalog";
import { parseProvided } from "@/lib/validation/partial";

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  productCount: number;
  children: CategoryNode[];
};

export async function listCategories(ctx: ServiceContext): Promise<CategoryNode[]> {
  authorize(ctx, "catalog:read");
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({
      where: { storeId: ctx.storeId },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    prisma.product.groupBy({
      by: ["categoryId"],
      where: { storeId: ctx.storeId, categoryId: { not: null } },
      _count: true,
    }),
  ]);

  const countMap = new Map(counts.map((row) => [row.categoryId!, row._count]));
  const nodes = new Map<string, CategoryNode>(
    categories.map((category) => [
      category.id,
      {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId: category.parentId,
        productCount: countMap.get(category.id) ?? 0,
        children: [],
      },
    ]),
  );

  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) nodes.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export async function createCategory(ctx: ServiceContext, raw: unknown) {
  authorize(ctx, "catalog:write");
  const input = categoryInputSchema.parse(raw);
  const slug = await uniqueStoreSlug("category", ctx.storeId, input.slug || slugify(input.name));

  if (input.parentId) {
    const parent = await prisma.category.findFirst({ where: { id: input.parentId, storeId: ctx.storeId } });
    if (!parent) throw new ValidationError("The selected parent category does not exist.");
  }

  const category = await prisma.category.create({
    data: {
      storeId: ctx.storeId,
      name: input.name,
      slug,
      description: input.description ?? null,
      parentId: input.parentId || null,
    },
  });
  await audit(ctx, "category.create", { type: "Category", id: category.id }, { name: category.name });
  return category;
}

export async function updateCategory(ctx: ServiceContext, id: string, raw: unknown) {
  authorize(ctx, "catalog:write");
  const existing = await prisma.category.findFirst({ where: { id, storeId: ctx.storeId } });
  if (!existing) throw new NotFoundError("Category");

  const input = parseProvided(categoryInputSchema, raw);
  if (input.parentId === id) throw new ValidationError("A category cannot be its own parent.");

  if (input.parentId) {
    // The parent must live in this store. Without this the write below would
    // happily point a category at another organization's tree, which
    // createCategory already refuses to do.
    const parent = await prisma.category.findFirst({
      where: { id: input.parentId, storeId: ctx.storeId },
      select: { id: true },
    });
    if (!parent) throw new NotFoundError("Parent category");

    // Prevent creating a cycle by walking up from the proposed parent. The walk
    // stays inside this store for the same reason.
    let cursor: string | null = input.parentId;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === id) throw new ValidationError("That would create a circular category tree.");
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const next: { parentId: string | null } | null = await prisma.category.findFirst({
        where: { id: cursor, storeId: ctx.storeId },
        select: { parentId: true },
      });
      cursor = next?.parentId ?? null;
    }
  }

  const slug =
    input.slug !== undefined || input.name !== undefined
      ? await uniqueStoreSlug("category", ctx.storeId, input.slug || slugify(input.name ?? existing.name), id)
      : undefined;

  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(slug !== undefined && { slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.parentId !== undefined && { parentId: input.parentId || null }),
    },
  });
  await audit(ctx, "category.update", { type: "Category", id });
  return category;
}

export async function deleteCategory(ctx: ServiceContext, id: string) {
  authorize(ctx, "catalog:write");
  const category = await prisma.category.findFirst({
    where: { id, storeId: ctx.storeId },
    include: { _count: { select: { children: true, products: true } } },
  });
  if (!category) throw new NotFoundError("Category");
  if (category._count.children > 0) {
    throw new ValidationError("Move or delete the sub-categories first.");
  }
  // Products keep existing; they simply become uncategorised.
  await prisma.category.delete({ where: { id } });
  await audit(ctx, "category.delete", { type: "Category", id }, { productsUncategorised: category._count.products });
  return category._count.products;
}
