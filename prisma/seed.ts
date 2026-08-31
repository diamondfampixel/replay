/**
 * Seeds a demo account and its fully populated store.
 *
 * Run with `npm run db:seed`. Safe to re-run — the demo organization is
 * removed and rebuilt so the data set stays deterministic.
 */
import "dotenv/config";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth";
import { provisionOrganization } from "../src/lib/services/provision";
import { seedDemoStore } from "../src/lib/demo/seed-store";

const DEMO_EMAIL = "demo@halyard.app";
const DEMO_PASSWORD = "demo1234";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const started = Date.now();

  try {
    console.log("→ resetting demo organization");
    await prisma.organization.deleteMany({ where: { isDemo: true } });

    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: { passwordHash: await hashPassword(DEMO_PASSWORD) },
      create: {
        email: DEMO_EMAIL,
        name: "Dana Okonkwo",
        passwordHash: await hashPassword(DEMO_PASSWORD),
      },
    });

    console.log("→ provisioning store");
    const { store } = await provisionOrganization(prisma, {
      userId: user.id,
      businessName: "Northwind Supply Co.",
      industry: "Apparel & home goods",
      description:
        "Northwind Supply Co. makes a small range of everyday essentials — fleece, canvas bags, stoneware and lighting — and makes each one properly.",
      targetCustomer:
        "Design-minded people in their late twenties to forties who buy fewer, better things and keep them for years.",
      brandPersonality: "Understated, practical, quietly confident. No hype.",
      primaryColor: "#0E7C66",
      secondaryColor: "#1A1A17",
      contactEmail: "hello@northwindsupply.test",
      isDemo: true,
    });

    await prisma.store.update({
      where: { id: store.id },
      data: { status: "ACTIVE" },
    });

    // A second teammate so the Users & roles screen is not a single row.
    const teammate = await prisma.user.upsert({
      where: { email: "marketing@halyard.app" },
      update: {},
      create: {
        email: "marketing@halyard.app",
        name: "Priya Raman",
        passwordHash: await hashPassword(DEMO_PASSWORD),
      },
    });
    await prisma.membership.create({
      data: {
        userId: teammate.id,
        organizationId: store.organizationId,
        role: "MARKETING",
      },
    });

    const summary = await seedDemoStore(prisma, store.id, {
      publicDir: path.join(process.cwd(), "public"),
      log: (message) => console.log(`  · ${message}`),
    });

    console.log(
      `\n✓ Seeded in ${((Date.now() - started) / 1000).toFixed(1)}s\n` +
        `  ${summary.products} products · ${summary.orders} orders · ` +
        `${summary.customers} customers · ${summary.events} raw events\n\n` +
        `  Sign in: ${DEMO_EMAIL} / ${DEMO_PASSWORD}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
