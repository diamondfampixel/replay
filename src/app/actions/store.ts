"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { serviceContext } from "@/lib/services/context";
import { guard, ok, fail } from "@/lib/action-result";
import {
  createContentPage, deleteContentPage, discardDraft, publishPage,
  saveDraftSections, updateContentPage, type ContentPageInput,
} from "@/lib/services/pages";
import { generateStoreConfig } from "@/lib/ai/store-builder";
import { isAIConfigured } from "@/lib/ai/config";
import { audit } from "@/lib/services/context";
import { resolveTheme } from "@/lib/storefront/theme";

export async function saveDraftAction(pageId: string, sections: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    const draft = await saveDraftSections(ctx, pageId, sections);
    revalidatePath("/admin/store/editor");
    return ok({ sections: draft.length }, "Draft saved");
  });
}

export async function publishPageAction(pageId: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    const result = await publishPage(ctx, pageId);
    const store = await prisma.store.findUniqueOrThrow({
      where: { id: ctx.storeId },
      select: { slug: true },
    });
    revalidatePath("/admin/store/editor");
    revalidatePath(`/s/${store.slug}`, "layout");
    return ok(result, "Published to your live store");
  });
}

export async function discardDraftAction(pageId: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await discardDraft(ctx, pageId);
    revalidatePath("/admin/store/editor");
    return ok(null, "Draft discarded");
  });
}

export async function setStoreStatusAction(status: "DRAFT" | "ACTIVE" | "PAUSED") {
  return guard(async () => {
    const ctx = await serviceContext();
    await prisma.store.update({ where: { id: ctx.storeId }, data: { status } });
    await audit(ctx, "store.status", { type: "Store", id: ctx.storeId }, { status });
    revalidatePath("/admin/store");
    return ok(
      null,
      status === "ACTIVE" ? "Your store is live" : status === "PAUSED" ? "Store paused" : "Store set to draft",
    );
  });
}

export async function regenerateHomepageAction(input: {
  focus?: string;
  sections?: string[];
}) {
  return guard(async () => {
    const ctx = await serviceContext();
    if (!(await isAIConfigured(ctx.storeId))) {
      return fail("No Anthropic API key is configured. Add one under Integrations to generate copy.");
    }

    const store = await prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId } });
    const [products, collections] = await Promise.all([
      prisma.product.findMany({
        where: { storeId: ctx.storeId, status: "ACTIVE" },
        select: { title: true },
        take: 15,
      }),
      prisma.collection.findMany({ where: { storeId: ctx.storeId }, select: { slug: true } }),
    ]);

    const generated = await generateStoreConfig(
      ctx.storeId,
      {
        businessName: store.name,
        industry: store.industry ?? "",
        description: input.focus ? `${store.description ?? ""}\n\nEmphasise: ${input.focus}` : store.description ?? "",
        sells: "",
        targetCustomer: store.targetCustomer ?? "",
        brandPersonality: store.brandPersonality ?? "",
        aesthetic: "editorial",
        direction: resolveTheme({ theme: store.theme, primaryColor: store.primaryColor }).direction,
        feel: [],
        primaryColor: store.primaryColor,
        secondaryColor: store.secondaryColor,
        contactEmail: store.contactEmail ?? "",
        sections: input.sections ?? [],
        seedDemoProducts: false,
        generateWithAI: true,
      },
      {
        productTitles: products.map((product) => product.title),
        collectionSlugs: collections.map((collection) => collection.slug),
        theme: resolveTheme({ theme: store.theme, primaryColor: store.primaryColor, secondaryColor: store.secondaryColor }),
      },
    );

    if (generated.source !== "ai") {
      return fail("The model did not return a usable layout. Nothing was changed.");
    }

    // Staged as a draft — never written straight to the live store.
    const page = await prisma.page.findFirstOrThrow({
      where: { storeId: ctx.storeId, type: "HOME" },
    });
    await saveDraftSections(
      ctx,
      page.id,
      generated.sections.map((section, index) => ({
        id: `draft-${index}`,
        type: section.type,
        visible: true,
        config: section.config,
      })),
    );

    revalidatePath("/admin/store/editor");
    return ok(
      { sections: generated.sections.length, pageId: page.id },
      `Generated ${generated.sections.length} sections as a draft. Review and publish when you are happy.`,
    );
  });
}

export async function applyGeneratedStoreAction(pageId: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await publishPage(ctx, pageId);
    return ok(null, "Published");
  });
}

// -- content pages ----------------------------------------------------------

export async function createPageAction(input: ContentPageInput) {
  return guard(async () => {
    const ctx = await serviceContext();
    const page = await createContentPage(ctx, input);
    revalidatePath("/admin/content");
    return ok({ id: page.id }, `${page.title} created`);
  });
}

export async function updatePageAction(pageId: string, input: ContentPageInput) {
  return guard(async () => {
    const ctx = await serviceContext();
    const page = await updateContentPage(ctx, pageId, input);
    const store = await prisma.store.findUniqueOrThrow({
      where: { id: ctx.storeId },
      select: { slug: true },
    });
    revalidatePath("/admin/content");
    revalidatePath(`/s/${store.slug}/pages/${page.slug}`);
    return ok({ id: page.id }, "Page saved");
  });
}

export async function deletePageAction(pageId: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    await deleteContentPage(ctx, pageId);
    revalidatePath("/admin/content");
    return ok(null, "Page deleted");
  });
}

export async function updateNavigationAction(
  group: "main" | "footer",
  items: Array<{ label: string; href: string }>,
) {
  return guard(async () => {
    const ctx = await serviceContext();
    await prisma.$transaction(async (tx) => {
      await tx.navigationItem.deleteMany({ where: { storeId: ctx.storeId, group } });
      if (items.length) {
        await tx.navigationItem.createMany({
          data: items.map((item, index) => ({
            storeId: ctx.storeId,
            label: item.label,
            href: item.href,
            position: index,
            group,
          })),
        });
      }
    });
    await audit(ctx, "navigation.update", { type: "Store", id: ctx.storeId }, { group, count: items.length });

    const store = await prisma.store.findUniqueOrThrow({
      where: { id: ctx.storeId },
      select: { slug: true },
    });
    revalidatePath("/admin/store");
    revalidatePath(`/s/${store.slug}`, "layout");
    return ok(null, "Navigation saved");
  });
}
