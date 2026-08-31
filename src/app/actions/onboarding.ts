"use server";

import path from "node:path";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { fail, fromZodError, guard, ok } from "@/lib/action-result";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { provisionOrganization, ensureHomepage } from "@/lib/services/provision";
import { applyGeneratedStore, generateStoreConfig } from "@/lib/ai/store-builder";
import { seedDemoStore } from "@/lib/demo/seed-store";
import { DEMO_CONTENT_PAGES } from "@/lib/demo/storefront-pages";

/**
 * Creates the caller's first organization + store. When `seedDemoProducts` is
 * set, the same generator the seed script uses populates the store so a new
 * account can explore a fully working business immediately.
 */
export async function completeOnboardingAction(payload: unknown) {
  return guard<{ storeId: string; generatedBy: "demo" | "ai" | "template" }>(async () => {
    const user = await requireUser();

    const existing = await prisma.membership.findFirst({ where: { userId: user.id } });
    if (existing) return fail("You already belong to an organization.");

    const parsed = onboardingSchema.safeParse(payload);
    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const { store } = await provisionOrganization(prisma, {
      userId: user.id,
      businessName: input.businessName,
      industry: input.industry,
      description: input.description,
      targetCustomer: input.targetCustomer || null,
      brandPersonality: input.brandPersonality || null,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      contactEmail: input.contactEmail || null,
      isDemo: input.seedDemoProducts,
    });

    if (input.seedDemoProducts) {
      await seedDemoStore(prisma, store.id, {
        publicDir: path.join(process.cwd(), "public"),
      });
      await prisma.store.update({ where: { id: store.id }, data: { status: "ACTIVE" } });
      return ok({ storeId: store.id, generatedBy: "demo" as const });
    }

    // Every store gets the standard content pages so the storefront is complete.
    await prisma.page.createMany({
      data: DEMO_CONTENT_PAGES.filter((page) =>
        ["about", "contact", "faq", "shipping", "returns", "privacy", "terms"].includes(page.slug),
      ).map((page) => ({
        storeId: store.id,
        type: "STANDARD" as const,
        title: page.title,
        slug: page.slug,
        body: `<p>Add your ${page.title.toLowerCase()} content here.</p>`,
        published: false,
        showInNav: page.showInNav ?? false,
      })),
      skipDuplicates: true,
    });

    await prisma.navigationItem.createMany({
      data: [
        { storeId: store.id, label: "Shop", href: "/shop", position: 0, group: "main" },
        { storeId: store.id, label: "About", href: "/pages/about", position: 1, group: "main" },
        { storeId: store.id, label: "Contact", href: "/pages/contact", position: 0, group: "footer" },
      ],
    });

    await ensureHomepage(prisma, store.id);
    const generated = await generateStoreConfig(store.id, input);
    await applyGeneratedStore(prisma, store.id, generated);

    return ok({ storeId: store.id, generatedBy: generated.source });
  });
}
