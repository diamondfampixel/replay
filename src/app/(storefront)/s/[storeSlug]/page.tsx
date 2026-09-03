import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getHomepage, getStore } from "@/lib/storefront/data";
import { getStorefrontSessionId } from "@/lib/storefront/session";
import { resolveExperiments } from "@/lib/storefront/experiments";
import { SectionRenderer } from "@/components/storefront/sections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<Metadata> {
  const { storeSlug } = await params;
  const store = await getStore(storeSlug);
  const page = await getHomepage(store.id);
  return {
    title: page?.seoTitle ?? store.name,
    description: page?.seoDescription ?? store.description ?? undefined,
  };
}

export default async function StorefrontHome({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getStore(storeSlug);
  const page = await getHomepage(store.id);
  if (!page) notFound();

  const sessionId = await getStorefrontSessionId();
  const assignments = await resolveExperiments(store.id, { pageId: page.id }, sessionId);

  // Map each running experiment to the section it patches.
  const experimentSections = assignments.length
    ? new Map(
        (
          await prisma.experiment.findMany({
            where: { id: { in: assignments.map((a) => a.experimentId) } },
            select: { id: true, sectionId: true },
          })
        ).map((experiment) => [experiment.id, experiment.sectionId]),
      )
    : new Map<string, string | null>();

  const sections = page.sections.filter((section) => section.visible);

  return (
    <>
      {sections.map((section, index) => {
        let config = (section.config ?? {}) as Record<string, unknown>;
        for (const assignment of assignments) {
          if (experimentSections.get(assignment.experimentId) === section.id) {
            config = { ...config, ...assignment.changes };
          }
        }
        return (
          <SectionRenderer
            key={section.id}
            store={store}
            section={{ id: section.id, type: section.type, visible: true, config }}
            index={index}
          />
        );
      })}
    </>
  );
}
