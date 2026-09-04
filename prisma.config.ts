import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct connection: Neon (and PgBouncer-style poolers
    // generally) cannot hold the advisory lock Prisma takes across a pooled
    // session. Vercel's Neon integration provides DATABASE_URL_UNPOOLED; the
    // Neon CLI provides a plain DATABASE_URL that is already direct. Runtime
    // code keeps using DATABASE_URL (src/lib/db.ts), which should be the
    // pooled string on serverless hosts.
    url: (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL) as string,
  },
});
