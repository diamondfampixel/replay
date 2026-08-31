import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { getCatalogFacets, listProducts } from "@/lib/services/products";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { DataToolbar, Pagination } from "@/components/admin/data-toolbar";
import { ProductsTable } from "@/components/admin/products-table";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const auth = await requireCapability("catalog:read");
  const ctx = await serviceContext();
  const params = await searchParams;

  const [result, facets, store, collections] = await Promise.all([
    listProducts(ctx, {
      q: params.q,
      status: params.status as never,
      categoryId: params.categoryId,
      collectionId: params.collectionId,
      vendor: params.vendor,
      tag: params.tag,
      stock: params.stock as never,
      sort: (params.sort as never) ?? "updated",
      page: params.page ? Number(params.page) : 1,
    }),
    getCatalogFacets(ctx.storeId),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
    prisma.collection.findMany({
      where: { storeId: ctx.storeId },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const canWrite = can(auth.role, "catalog:write");

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Products"
        description={`${result.total} product${result.total === 1 ? "" : "s"} in your catalog`}
        actions={
          canWrite && (
            <Button asChild size="sm" variant="primary">
              <Link href="/admin/products/new">
                <Plus />
                Create product
              </Link>
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        <DataToolbar
          searchPlaceholder="Search title, SKU, description or vendor…"
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "ACTIVE", label: "Active" },
                { value: "DRAFT", label: "Draft" },
                { value: "ARCHIVED", label: "Archived" },
              ],
            },
            {
              key: "categoryId",
              label: "Category",
              options: facets.categories.map((category) => ({ value: category.id, label: category.name })),
            },
            {
              key: "collectionId",
              label: "Collection",
              options: collections.map((collection) => ({ value: collection.id, label: collection.title })),
            },
            {
              key: "vendor",
              label: "Vendor",
              options: facets.vendors.map((vendor) => ({ value: vendor, label: vendor })),
            },
            {
              key: "tag",
              label: "Tag",
              options: facets.tags.map((tag) => ({ value: tag, label: tag })),
            },
            {
              key: "stock",
              label: "Stock",
              options: [
                { value: "in", label: "In stock" },
                { value: "low", label: "Low (≤10)" },
                { value: "out", label: "Out of stock" },
              ],
            },
          ]}
          sortOptions={[
            { value: "updated", label: "Recently updated" },
            { value: "created", label: "Newest" },
            { value: "title", label: "Title A–Z" },
            { value: "price_desc", label: "Price high → low" },
            { value: "price_asc", label: "Price low → high" },
            { value: "inventory", label: "Inventory low → high" },
            { value: "revenue", label: "Revenue" },
          ]}
        />
        <ProductsTable rows={result.rows} currency={store.currency} canWrite={canWrite} />
        {result.total > 0 && (
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            perPage={result.perPage}
          />
        )}
      </Card>
    </div>
  );
}
