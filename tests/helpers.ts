import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { provisionOrganization } from "@/lib/services/provision";
import { hashPassword } from "@/lib/auth";
import type { ServiceContext } from "@/lib/services/context";

export const testDb = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let counter = 0;

/** Creates an isolated organization + store for one test file. */
export async function createTestStore(label: string) {
  counter += 1;
  const suffix = `${Date.now().toString(36)}-${counter}`;
  const user = await testDb.user.create({
    data: {
      email: `test-${label}-${suffix}@example.test`,
      name: "Test Owner",
      passwordHash: await hashPassword("password123"),
    },
  });

  const { organization, store } = await provisionOrganization(testDb, {
    userId: user.id,
    businessName: `Test ${label} ${suffix}`,
    description: "A store created by the automated test suite.",
  });

  await testDb.store.update({ where: { id: store.id }, data: { status: "ACTIVE" } });
  // Feature tests exercise behaviour, not plan gates, so test organizations get
  // the top plan. Plan-limit tests set the plan they need explicitly.
  await testDb.organization.update({ where: { id: organization.id }, data: { plan: "flagship" } });

  const ctx: ServiceContext = {
    storeId: store.id,
    organizationId: organization.id,
    userId: user.id,
    role: "OWNER",
    actor: "user",
  };

  return { user, organization, store, ctx };
}

export async function cleanupTestStore(organizationId: string, userId: string) {
  await testDb.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  await testDb.user.delete({ where: { id: userId } }).catch(() => undefined);
}

export function analystContext(ctx: ServiceContext): ServiceContext {
  return { ...ctx, role: "ANALYST" };
}
