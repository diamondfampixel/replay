import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EVENT_TYPES = [
  "page_view",
  "hero_cta",
  "waitlist_started",
  "waitlist_submitted",
  "demo_viewed",
  "pricing_viewed",
  "faq_opened",
  "login_click",
] as const;

const bodySchema = z.object({
  type: z.enum(EVENT_TYPES),
  path: z.string().max(300).optional().nullable(),
  visitorId: z.string().min(8).max(64),
  source: z.string().max(80).optional().nullable(),
  utmSource: z.string().max(120).optional().nullable(),
  utmMedium: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(120).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
});

/**
 * First-party marketing analytics. A random visitor id, an event name, and
 * where the visit came from — no IP stored, no user agent, no cookies, no
 * third-party script. Enough to know whether the marketing works.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const limit = await rateLimit(`mkt:${parsed.data.visitorId}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ ok: true, throttled: true });

  await prisma.marketingEvent
    .create({
      data: {
        type: parsed.data.type,
        path: parsed.data.path ?? null,
        visitorId: parsed.data.visitorId,
        source: parsed.data.source ?? null,
        utmSource: parsed.data.utmSource ?? null,
        utmMedium: parsed.data.utmMedium ?? null,
        utmCampaign: parsed.data.utmCampaign ?? null,
        referrer: parsed.data.referrer ?? null,
      },
    })
    .catch(() => undefined); // analytics never surfaces failures to a visitor

  return NextResponse.json({ ok: true });
}
