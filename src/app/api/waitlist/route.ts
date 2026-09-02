import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { joinWaitlist, waitlistInputSchema } from "@/lib/services/waitlist";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = await rateLimit(`waitlist:${ip}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const parsed = waitlistInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    await joinWaitlist(parsed.data);
    // Duplicate joins return the same success on purpose — see joinWaitlist.
    return NextResponse.json({ ok: true });
  } catch (error) {
    reportError("api/waitlist", error);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
