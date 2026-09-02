/**
 * Prints the waitlist funnel: signups by day, by source, and the marketing
 * event funnel — the numbers that say whether the TikToks are working.
 *
 *   npx tsx scripts/waitlist-report.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const total = await prisma.waitlistEntry.count();
  console.log(`\nWaitlist: ${total} signups\n`);

  const bySource = await prisma.waitlistEntry.groupBy({
    by: ["utmSource"],
    _count: true,
    orderBy: { _count: { utmSource: "desc" } },
  });
  console.log("By source:");
  for (const row of bySource) console.log(`  ${row.utmSource ?? "(direct)"}  ${row._count}`);

  const byDay = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
    SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
    FROM "WaitlistEntry" GROUP BY 1 ORDER BY 1 DESC LIMIT 14`;
  console.log("\nLast 14 days:");
  for (const row of byDay) console.log(`  ${row.day.toISOString().slice(0, 10)}  ${row.count}`);

  const funnel = await prisma.marketingEvent.groupBy({
    by: ["type"],
    _count: true,
    orderBy: { _count: { type: "desc" } },
  });
  const uniques = await prisma.$queryRaw<Array<{ type: string; visitors: bigint }>>`
    SELECT type, count(DISTINCT "visitorId") AS visitors FROM "MarketingEvent" GROUP BY 1`;
  const uniqueMap = new Map(uniques.map((row) => [row.type, Number(row.visitors)]));
  console.log("\nFunnel (events / unique visitors):");
  for (const row of funnel) {
    console.log(`  ${row.type.padEnd(20)} ${String(row._count).padStart(5)} / ${uniqueMap.get(row.type) ?? 0}`);
  }

  await prisma.$disconnect();
}
main().catch((error) => { console.error(error); process.exit(1); });
