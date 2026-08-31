import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { EVENT_TYPES, classifyDevice, trackEvent } from "@/lib/services/events";
import { recordExperimentEvent } from "@/lib/services/experiments";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  storeSlug: z.string().min(1).max(120),
  type: z.enum(EVENT_TYPES),
  sessionId: z.string().min(4).max(64),
  productId: z.string().max(40).optional().nullable(),
  collectionId: z.string().max(40).optional().nullable(),
  path: z.string().max(300).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  utmSource: z.string().max(80).optional().nullable(),
  utmMedium: z.string().max(80).optional().nullable(),
  utmCampaign: z.string().max(80).optional().nullable(),
  value: z.number().min(0).max(1_000_000).optional().nullable(),
  /** Experiment impressions arrive with the event that produced them. */
  experiments: z
    .array(z.object({ experimentId: z.string(), variantId: z.string() }))
    .max(8)
    .optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }
  const body = parsed.data;

  const limit = rateLimit(`track:${body.sessionId}`, { limit: 120, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ ok: true, throttled: true });

  const store = await prisma.store.findUnique({
    where: { slug: body.storeSlug },
    select: { id: true },
  });
  if (!store) return NextResponse.json({ error: "Unknown store" }, { status: 404 });

  const headerList = await headers();

  try {
    await trackEvent({
      storeId: store.id,
      type: body.type,
      sessionId: body.sessionId,
      productId: body.productId ?? null,
      collectionId: body.collectionId ?? null,
      path: body.path ?? null,
      referrer: body.referrer ?? null,
      utmSource: body.utmSource ?? null,
      utmMedium: body.utmMedium ?? null,
      utmCampaign: body.utmCampaign ?? null,
      device: classifyDevice(headerList.get("user-agent")),
      value: body.value ?? null,
    });

    for (const assignment of body.experiments ?? []) {
      await recordExperimentEvent({
        experimentId: assignment.experimentId,
        variantId: assignment.variantId,
        sessionId: body.sessionId,
        type: "impression",
      });
    }
  } catch (error) {
    console.error("[api/track]", error);
    // Never let analytics failures surface to a shopper.
    return NextResponse.json({ ok: false });
  }

  return NextResponse.json({ ok: true });
}
