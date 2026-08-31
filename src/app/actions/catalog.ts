"use server";

import { revalidatePath } from "next/cache";
import { serviceContext } from "@/lib/services/context";
import { guard, ok } from "@/lib/action-result";
import {
  createProduct, deleteProducts, duplicateProduct, setProductStatus, updateProduct,
} from "@/lib/services/products";
import {
  addProductsToCollection, createCollection, deleteCollection,
  removeProductsFromCollection, updateCollection,
} from "@/lib/services/collections";
import { createCategory, deleteCategory, updateCategory } from "@/lib/services/categories";
import type { ProductStatus } from "@/generated/prisma/client";

// -- products ---------------------------------------------------------------

export async function createProductAction(input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    const product = await createProduct(ctx, input);
    revalidatePath("/admin/products");
    return ok({ id: product.id }, `${product.title} created`);
  });
}

export async function updateProductAction(id: string, input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    const product = await updateProduct(ctx, id, input);
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    return ok({ id: product.id }, "Changes saved");
  });
}

export async function setProductStatusAction(ids: string[], status: ProductStatus) {
  return guard(async () => {
    const ctx = await serviceContext();
    const count = await setProductStatus(ctx, ids, status);
    revalidatePath("/admin/products");
    return ok({ count }, `${count} product${count === 1 ? "" : "s"} set to ${status.toLowerCase()}`);
  });
}

export async function duplicateProductAction(id: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    const copy = await duplicateProduct(ctx, id);
    revalidatePath("/admin/products");
    return ok({ id: copy.id }, "Product duplicated");
  });
}

export async function deleteProductsAction(ids: string[]) {
  return guard(async () => {
    const ctx = await serviceContext();
    const count = await deleteProducts(ctx, ids);
    revalidatePath("/admin/products");
    return ok({ count }, `${count} product${count === 1 ? "" : "s"} deleted`);
  });
}

// -- collections ------------------------------------------------------------

export async function createCollectionAction(input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    const collection = await createCollection(ctx, input);
    revalidatePath("/admin/collections");
    return ok({ id: collection.id }, `${collection.title} created`);
  });
}

export async function updateCollectionAction(id: string, input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    await updateCollection(ctx, id, input);
    revalidatePath("/admin/collections");
    revalidatePath(`/admin/collections/${id}`);
    return ok({ id }, "Changes saved");
  });
}

export async function addProductsToCollectionAction(id: string, productIds: string[]) {
  return guard(async () => {
    const ctx = await serviceContext();
    const count = await addProductsToCollection(ctx, id, productIds);
    revalidatePath(`/admin/collections/${id}`);
    return ok({ count }, `${count} product${count === 1 ? "" : "s"} added`);
  });
}

export async function removeProductsFromCollectionAction(id: string, productIds: string[]) {
  return guard(async () => {
    const ctx = await serviceContext();
    const count = await removeProductsFromCollection(ctx, id, productIds);
    revalidatePath(`/admin/collections/${id}`);
    return ok({ count }, "Removed from collection");
  });
}

export async function deleteCollectionAction(id: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await deleteCollection(ctx, id);
    revalidatePath("/admin/collections");
    return ok(null, "Collection deleted");
  });
}

// -- categories -------------------------------------------------------------

export async function createCategoryAction(input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    const category = await createCategory(ctx, input);
    revalidatePath("/admin/categories");
    return ok({ id: category.id }, `${category.name} created`);
  });
}

export async function updateCategoryAction(id: string, input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    await updateCategory(ctx, id, input);
    revalidatePath("/admin/categories");
    return ok({ id }, "Category updated");
  });
}

export async function deleteCategoryAction(id: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    const uncategorised = await deleteCategory(ctx, id);
    revalidatePath("/admin/categories");
    return ok(
      { uncategorised },
      uncategorised
        ? `Category deleted. ${uncategorised} product${uncategorised === 1 ? "" : "s"} are now uncategorised.`
        : "Category deleted",
    );
  });
}
