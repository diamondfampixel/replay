import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStore } from "@/lib/storefront/data";
import { SectionRenderer } from "@/components/storefront/sections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string; slug: string }>;
}): Promise<Metadata> {
  const { storeSlug, slug } = await params;
  const store = await getStore(storeSlug);
  const page = await prisma.page.findFirst({
    where: { storeId: store.id, slug, published: true },
    select: { title: true, seoTitle: true, seoDescription: true },
  });
  if (!page) return { title: "Page not found" };
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? undefined };
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ storeSlug: string; slug: string }>;
}) {
  const { storeSlug, slug } = await params;
  const store = await getStore(storeSlug);

  const page = await prisma.page.findFirst({
    where: { storeId: store.id, slug, published: true, type: { not: "HOME" } },
    include: { sections: { orderBy: { position: "asc" }, where: { visible: true } } },
  });
  if (!page) notFound();

  // Landing pages are section-built; standard pages carry rich text.
  if (page.sections.length > 0) {
    return (
      <>
        {page.sections.map((section) => (
          <SectionRenderer
            key={section.id}
            store={store}
            section={{
              id: section.id,
              type: section.type,
              visible: true,
              config: (section.config ?? {}) as Record<string, unknown>,
            }}
          />
        ))}
      </>
    );
  }

  return (
    <article className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-ink-900">{page.title}</h1>
      <div
        className="prose-halyard mt-6"
        // Page bodies are authored by store staff in the admin, which is a
        // trusted surface; the storefront renders exactly what was saved.
        dangerouslySetInnerHTML={{ __html: page.body ?? "" }}
      />
    </article>
  );
}
