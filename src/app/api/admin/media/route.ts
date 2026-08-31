import { NextResponse } from "next/server";
import { serviceContext } from "@/lib/services/context";
import { listMedia, uploadMedia } from "@/lib/services/media";
import { rateLimit } from "@/lib/rate-limit";
import { AuthorizationError } from "@/lib/permissions";
import { ValidationError } from "@/lib/services/context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const ctx = await serviceContext();
    const params = new URL(request.url).searchParams;
    const result = await listMedia(ctx, {
      page: Number(params.get("page") ?? 1),
      q: params.get("q") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await serviceContext();
    const limit = rateLimit(`media:${ctx.storeId}`, { limit: 60, windowMs: 60_000 });
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many uploads. Try again shortly." }, { status: 429 });
    }

    const formData = await request.formData();
    const files = formData.getAll("file").filter((entry): entry is File => entry instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    }

    const alt = formData.get("alt");
    const assets = [];
    for (const file of files) {
      assets.push(await uploadMedia(ctx, file, typeof alt === "string" ? alt : undefined));
    }
    return NextResponse.json({ assets });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  console.error("[api/media]", error);
  const message = error instanceof Error ? error.message : "Upload failed";
  return NextResponse.json({ error: message }, { status: 500 });
}
