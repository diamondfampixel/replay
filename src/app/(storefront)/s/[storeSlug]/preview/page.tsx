import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getStore } from "@/lib/storefront/data";
import { SectionRenderer } from "@/components/storefront/sections";
import { requireCapability } from "@/lib/session";
import { normaliseSectionConfig, isSectionType } from "@/lib/storefront/sections";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Renders a page's unpublished draft. Admin-only: the draft belongs to the
 * operator, not to shoppers, so this is gated behind the same capability the
 * editor requires rather than being publicly reachable.
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { storeSlug } = await params;
  const query = await searchParams;
  const auth = await requireCapability("storefront:read");
  const store = await getStore(storeSlug);
  if (auth.storeId !== store.id) notFound();

  const page = query.page
    ? await prisma.page.findFirst({
        where: { id: query.page, storeId: store.id },
        include: { sections: { orderBy: { position: "asc" } } },
      })
    : await prisma.page.findFirst({
        where: { storeId: store.id, type: "HOME" },
        include: { sections: { orderBy: { position: "asc" } } },
      });
  if (!page) notFound();

  const draft = Array.isArray(page.draftSections) ? page.draftSections : null;
  const sections = draft
    ? (draft as Array<Record<string, unknown>>)
        .filter((section) => typeof section.type === "string" && isSectionType(section.type as string))
        .map((section, index) => ({
          id: (section.id as string) ?? `draft-${index}`,
          type: section.type as string,
          visible: section.visible !== false,
          config: normaliseSectionConfig(section.type as string, section.config),
        }))
    : page.sections.map((section) => ({
        id: section.id,
        type: section.type,
        visible: section.visible,
        config: (section.config ?? {}) as Record<string, unknown>,
      }));

  return (
    <>
      {sections
        .filter((section) => section.visible)
        .map((section) => (
          <SectionRenderer key={section.id} store={store} section={{ ...section, visible: true }} preview />
        ))}
      {sections.length === 0 && (
        <div className="px-6 py-24 text-center text-[14px] text-ink-500">
          This page has no sections yet. Add one from the panel on the left.
        </div>
      )}
    </>
  );
}
