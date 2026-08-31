/** Development helper: mints a session cookie for an account so pages can be
 *  smoke-tested with curl. Not used by the application. */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateToken, hashToken } from "../src/lib/auth";

const email = process.argv[2] ?? "demo@halyard.app";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const token = generateToken();
  await prisma.session.create({
    data: { userId: user.id, token: hashToken(token), expiresAt: new Date(Date.now() + 864e5) },
  });
  console.log(token);
  await prisma.$disconnect();
}

main();
