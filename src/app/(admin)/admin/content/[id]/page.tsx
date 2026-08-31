import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { can } from "@/lib/permissions";
import { PageForm } from "@/components/admin/page-form";

export const metadata: Metadata = { title: "Page" };
export const dynamic = "force-dynamic";

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("content:read");
  const { id } = await params;

  const [page, store] = await Promise.all([
    prisma.page.findFirst({ where: { id, storeId: auth.storeId } }),
    prisma.store.findUniqueOrThrow({ where: { id: auth.storeId }, select: { slug: true } }),
  ]);
  if (!page) notFound();
  // The homepage is section-built, so it belongs in the store editor.
  if (page.type === "HOME") redirect("/admin/store/editor");

  return (
    <PageForm
      pageId={page.id}
      initial={{
        title: page.title,
        slug: page.slug,
        body: page.body ?? "<p></p>",
        published: page.published,
        showInNav: page.showInNav,
        seoTitle: page.seoTitle ?? "",
        seoDescription: page.seoDescription ?? "",
      }}
      storefrontUrl={`/s/${store.slug}/pages/${page.slug}`}
      canWrite={can(auth.role, "content:write")}
    />
  );
}
