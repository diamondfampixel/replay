import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { slugify } from "@/lib/utils";
import { defaultHomepageSections } from "@/lib/demo/storefront-pages";
import { INTEGRATION_CATALOG } from "@/lib/integrations/catalog";

async function uniqueSlug(
  db: PrismaClient,
  base: string,
  check: (slug: string) => Promise<boolean>,
) {
  const root = slugify(base) || "store";
  let candidate = root;
  let n = 1;
  while (await check(candidate)) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}

export type ProvisionInput = {
  userId: string;
  businessName: string;
  industry?: string | null;
  description?: string | null;
  targetCustomer?: string | null;
  brandPersonality?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  contactEmail?: string | null;
  isDemo?: boolean;
};

/**
 * Creates an organization, its first store, the default storefront pages and
 * the integration rows for every provider in the catalog. Used by onboarding
 * and by the seed script so both paths produce identical structure.
 */
export async function provisionOrganization(db: PrismaClient, input: ProvisionInput) {
  const orgSlug = await uniqueSlug(db, input.businessName, async (slug) =>
    Boolean(await db.organization.findUnique({ where: { slug } })),
  );
  const storeSlug = await uniqueSlug(db, input.businessName, async (slug) =>
    Boolean(await db.store.findUnique({ where: { slug } })),
  );

  const organization = await db.organization.create({
    data: {
      name: input.businessName,
      slug: orgSlug,
      plan: input.isDemo ? "demo" : "starter",
      isDemo: input.isDemo ?? false,
      memberships: { create: { userId: input.userId, role: "OWNER" } },
    },
  });

  const store = await db.store.create({
    data: {
      organizationId: organization.id,
      name: input.businessName,
      slug: storeSlug,
      status: "DRAFT",
      isDemo: input.isDemo ?? false,
      industry: input.industry ?? null,
      description: input.description ?? null,
      targetCustomer: input.targetCustomer ?? null,
      brandPersonality: input.brandPersonality ?? null,
      primaryColor: input.primaryColor ?? "#0E7C66",
      secondaryColor: input.secondaryColor ?? "#111827",
      contactEmail: input.contactEmail ?? null,
      domain: `${storeSlug}.halyard.store`,
      settings: { create: {} },
    },
  });

  // Integration rows exist up front so the marketplace reflects real state
  // rather than pretending. Everything starts NOT_CONFIGURED.
  await db.integration.createMany({
    data: INTEGRATION_CATALOG.map((integration) => ({
      storeId: store.id,
      provider: integration.id,
      status: "NOT_CONFIGURED" as const,
    })),
    skipDuplicates: true,
  });

  return { organization, store };
}

/** Creates the default homepage for a store that has none. */
export async function ensureHomepage(db: PrismaClient, storeId: string) {
  const existing = await db.page.findFirst({ where: { storeId, type: "HOME" } });
  if (existing) return existing;

  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  const sections = defaultHomepageSections({ name: store.name, description: store.description });

  return db.page.create({
    data: {
      storeId,
      type: "HOME",
      title: "Home",
      slug: "home",
      published: true,
      publishedAt: new Date(),
      sections: {
        create: sections.map((section, index) => ({
          type: section.type,
          position: index,
          visible: section.visible ?? true,
          config: section.config as Prisma.InputJsonValue,
        })),
      },
    },
  });
}
