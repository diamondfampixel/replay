import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit, authorize, ValidationError, type ServiceContext } from "@/lib/services/context";
import { slugify } from "@/lib/utils";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/avif"]);

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

/**
 * Stores an uploaded image.
 *
 * Local disk under `public/uploads` is the default so the app works with no
 * external service. When Supabase storage credentials are present the file is
 * uploaded there instead and the public URL is recorded.
 */
export async function uploadMedia(ctx: ServiceContext, file: File, alt?: string) {
  authorize(ctx, "content:write");

  if (!ALLOWED.has(file.type)) {
    throw new ValidationError(`Unsupported file type: ${file.type || "unknown"}. Upload a JPEG, PNG, WebP, AVIF, GIF or SVG.`);
  }
  if (file.size > MAX_BYTES) {
    throw new ValidationError(`That file is ${(file.size / 1e6).toFixed(1)}MB. The limit is 8MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = EXTENSIONS[file.type] ?? "bin";
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "upload";
  const filename = `${base}-${randomBytes(4).toString("hex")}.${extension}`;

  const url = await persist(ctx.storeId, filename, buffer, file.type);

  const asset = await prisma.mediaAsset.create({
    data: {
      storeId: ctx.storeId,
      filename,
      url,
      mimeType: file.type,
      size: buffer.byteLength,
      alt: alt ?? null,
    },
  });

  await audit(ctx, "media.upload", { type: "MediaAsset", id: asset.id }, { filename, size: buffer.byteLength });
  return asset;
}

async function persist(storeId: string, filename: string, buffer: Buffer, contentType: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";

  if (supabaseUrl && supabaseKey) {
    const objectPath = `${storeId}/${filename}`;
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
        body: new Uint8Array(buffer),
      },
    );
    if (!response.ok) {
      throw new ValidationError(`Storage upload failed (${response.status}). Check your Supabase bucket configuration.`);
    }
    return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${objectPath}`;
  }

  const directory = path.join(process.cwd(), "public", "uploads", storeId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), buffer);
  return `/uploads/${storeId}/${filename}`;
}

export async function listMedia(ctx: ServiceContext, options: { page?: number; perPage?: number; q?: string } = {}) {
  authorize(ctx, "content:read");
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 48;

  const where = {
    storeId: ctx.storeId,
    ...(options.q ? { filename: { contains: options.q, mode: "insensitive" as const } } : {}),
  };

  const [total, assets] = await Promise.all([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return { assets, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export async function deleteMedia(ctx: ServiceContext, id: string) {
  authorize(ctx, "content:write");
  const asset = await prisma.mediaAsset.findFirst({ where: { id, storeId: ctx.storeId } });
  if (!asset) throw new ValidationError("That file no longer exists.");

  // Only local files are removed from disk; remote objects are left in place so
  // a shared bucket is never mutated unexpectedly.
  if (asset.url.startsWith("/uploads/")) {
    await unlink(path.join(process.cwd(), "public", asset.url)).catch(() => undefined);
  }
  await prisma.mediaAsset.delete({ where: { id } });
  await audit(ctx, "media.delete", { type: "MediaAsset", id });
  return true;
}

export async function updateMediaAlt(ctx: ServiceContext, id: string, alt: string) {
  authorize(ctx, "content:write");
  return prisma.mediaAsset.update({
    where: { id },
    data: { alt },
  });
}
