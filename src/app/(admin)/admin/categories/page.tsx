import type { Metadata } from "next";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { listCategories } from "@/lib/services/categories";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page";
import { CategoriesManager } from "@/components/admin/categories-manager";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const auth = await requireCapability("catalog:read");
  const ctx = await serviceContext();
  const tree = await listCategories(ctx);
  const canWrite = can(auth.role, "catalog:write");

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader
        title="Categories"
        description="How products are classified. Categories are hierarchical and separate from collections, which exist for merchandising."
      />
      <CategoriesManager tree={tree} canWrite={canWrite} />
    </div>
  );
}
