import { NextResponse } from "next/server";
import { getActiveContext } from "@/lib/session";
import { searchBusinessData } from "@/lib/services/search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await getActiveContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.trim().length < 2) return NextResponse.json({ hits: [] });

  const hits = await searchBusinessData(ctx.storeId, query, 4);
  return NextResponse.json({ hits });
}
