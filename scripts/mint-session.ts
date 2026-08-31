/**
 * Mints a session cookie for a user so smoke sweeps can hit admin routes
 * without driving the login form.
 *
 * This deliberately skips password verification, so it refuses to run outside
 * development. It needs DATABASE_URL and AUTH_SECRET to work at all, which
 * means anyone who can run it already holds the store's secrets — but the
 * guard keeps an absent-minded `NODE_ENV=production` invocation from handing
 * out a live session.
 *
 *   npx tsx scripts/mint-session.ts [email]
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("mint-session is a development helper and will not run in production.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const email = process.argv[2] ?? "demo@halyard.app";
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? ""}:${token}`)
    .digest("hex");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.session.create({
    data: { userId: user.id, token: hash, expiresAt: new Date(Date.now() + 864e5) },
  });
  console.log(token);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
