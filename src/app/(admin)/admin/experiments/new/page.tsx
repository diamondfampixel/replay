import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { isAIConfigured } from "@/lib/ai/config";
import { summariseSection, SECTION_META, isSectionType } from "@/lib/storefront/sections";
import { ExperimentForm } from "@/components/admin/experiment-form";

export const metadata: Metadata = { title: "New experiment" };
export const dynamic = "force-dynamic";

export default async function NewExperimentPage() {
  const ctx = await requireCapability("experiments:write");

  const [pages, products, aiConfigured] = await Promise.all([
    prisma.page.findMany({
      where: { storeId: ctx.storeId, type: { in: ["HOME", "LANDING"] } },
      include: { sections: { orderBy: { position: "asc" } } },
    }),
    prisma.product.findMany({
      where: { storeId: ctx.storeId, status: "ACTIVE" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 200,
    }),
    isAIConfigured(ctx.storeId),
  ]);

  const sections = pages.flatMap((page) =>
    page.sections.map((section) => {
      const config = (section.config ?? {}) as Record<string, unknown>;
      const label = isSectionType(section.type) ? SECTION_META[section.type].label : section.type;
      const currentValue =
        typeof config.headline === "string" ? config.headline
        : typeof config.heading === "string" ? config.heading
        : typeof config.text === "string" ? config.text
        : "";
      return {
        pageId: page.id,
        id: section.id,
        type: section.type,
        label: `${label} — ${summariseSection(section.type, config) || "no copy"}`,
        currentValue,
      };
    }),
  );

  return (
    <ExperimentForm
      pages={pages.map((page) => ({ id: page.id, label: page.type === "HOME" ? "Homepage" : page.title }))}
      products={products.map((product) => ({ id: product.id, label: product.title }))}
      sections={sections}
      aiConfigured={aiConfigured}
    />
  );
}
