import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit, authorize, ValidationError, type ServiceContext } from "@/lib/services/context";
import { slugify } from "@/lib/utils";
import { reportError } from "@/lib/monitoring";

export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Raster formats only. SVG is deliberately not accepted: an SVG is a document
 * that can carry scripts and external references, and serving merchant-
 * uploaded SVGs from the platform's own origin is a cross-site-scripting
 * vector. Logos should be exported as PNG or WebP until an SVG sanitiser ships.
 */
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/**
 * The declared type is client-supplied and must agree with the bytes: a file
 * renamed from .html to .png would otherwise be stored and served as an image.
 */
export function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  const head = buffer.subarray(0, 6).toString("ascii");
  if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "image/avif";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Storage providers. Local disk is a development convenience only: on a
// serverless host the filesystem is read-only or discarded on every deploy,
// so a production deployment must have one of the durable providers.
// ---------------------------------------------------------------------------
export type MediaStorage =
  | { provider: "supabase"; durable: true; label: string }
  | { provider: "vercel-blob"; durable: true; label: string }
  | { provider: "local"; durable: boolean; label: string };

export function mediaStorage(): MediaStorage {
  if (process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { provider: "supabase", durable: true, label: "Supabase Storage" };
  }
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return { provider: "vercel-blob", durable: true, label: "Vercel Blob" };
  }
  // A self-hosted server with a persistent disk may opt in explicitly. Never
  // the default: on serverless hosts the disk is discarded on every deploy.
  if (process.env.MEDIA_STORAGE?.trim().toLowerCase() === "local") {
    return { provider: "local", durable: true, label: "server disk (MEDIA_STORAGE=local)" };
  }
  return { provider: "local", durable: false, label: "local disk (development only)" };
}

/** True when uploads would be lost or refused on this deployment. */
export function mediaStorageNeedsSetup(): boolean {
  return process.env.NODE_ENV === "production" && !mediaStorage().durable;
}

const SETUP_MESSAGE =
  "Image storage isn't connected on this deployment yet, so uploads are paused to avoid losing files. The Halyard team needs to connect durable storage (Supabase Storage or Vercel Blob).";

/**
 * Stores an uploaded image for the caller's store.
 */
export async function uploadMedia(ctx: ServiceContext, file: File, alt?: string) {
  authorize(ctx, "content:write");

  if (mediaStorageNeedsSetup()) throw new ValidationError(SETUP_MESSAGE);

  if (file.type === "image/svg+xml") {
    throw new ValidationError("SVG files aren't supported yet. Export the image as PNG or WebP and upload that.");
  }
  if (!ALLOWED.has(file.type)) {
    throw new ValidationError(`Unsupported file type: ${file.type || "unknown"}. Upload a JPEG, PNG, WebP, AVIF or GIF.`);
  }
  if (file.size > MEDIA_MAX_BYTES) {
    throw new ValidationError(`That file is ${(file.size / 1e6).toFixed(1)}MB. The limit is 8MB.`);
  }
  if (file.size === 0) throw new ValidationError("That file is empty.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = sniffImageType(buffer);
  if (!detected || !ALLOWED.has(detected)) {
    throw new ValidationError("That file doesn't look like an image. Upload a JPEG, PNG, WebP, AVIF or GIF.");
  }
  // Trust the bytes over the declared type for the stored MIME and extension.
  const mimeType = detected;
  const extension = EXTENSIONS[mimeType] ?? "bin";
  const base = slugify(file.name.replace(/\.[^.]+$/, "")).slice(0, 60) || "upload";
  const filename = `${base}-${randomBytes(4).toString("hex")}.${extension}`;

  const url = await persist(ctx.storeId, filename, buffer, mimeType);

  const asset = await prisma.mediaAsset.create({
    data: {
      storeId: ctx.storeId,
      filename,
      url,
      mimeType,
      size: buffer.byteLength,
      alt: alt ?? null,
    },
  });

  await audit(ctx, "media.upload", { type: "MediaAsset", id: asset.id }, { filename, size: buffer.byteLength });
  return asset;
}

async function persist(storeId: string, filename: string, buffer: Buffer, contentType: string): Promise<string> {
  const storage = mediaStorage();
  // Every object lives under its store's id: one tenant's key space can never
  // address another's, whichever provider is behind it.
  const objectPath = `${storeId}/${filename}`;

  if (storage.provider === "supabase") {
    const supabaseUrl = process.env.SUPABASE_URL!.replace(/\/$/, "");
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
    const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: new Uint8Array(buffer),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      reportError("media/supabase", new Error(`Supabase storage responded ${response.status}`), { storeId });
      throw new ValidationError("The image couldn't be stored right now. Please try again in a moment.");
    }
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
  }

  if (storage.provider === "vercel-blob") {
    const { put } = await import("@vercel/blob");
    try {
      const blob = await put(`media/${objectPath}`, buffer, {
        access: "public",
        contentType,
        addRandomSuffix: false,
      });
      return blob.url;
    } catch (error) {
      reportError("media/vercel-blob", error, { storeId });
      throw new ValidationError("The image couldn't be stored right now. Please try again in a moment.");
    }
  }

  const directory = path.join(process.cwd(), "public", "uploads", storeId);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), buffer);
  } catch (error) {
    // A read-only filesystem (serverless) lands here when the production
    // guard above is bypassed by a non-production NODE_ENV.
    reportError("media/local", error, { storeId });
    throw new ValidationError(SETUP_MESSAGE);
  }
  return `/uploads/${storeId}/${filename}`;
}

export async function listMedia(ctx: ServiceContext, options: { page?: number; perPage?: number; q?: string } = {}) {
  authorize(ctx, "content:read");
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(200, Math.max(1, options.perPage ?? 48));

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

  // The database row is the source of truth; removing the object itself is
  // best-effort so a storage hiccup never leaves a ghost entry in the library.
  await removeObject(asset.url, ctx.storeId).catch((error) => reportError("media/delete", error, { storeId: ctx.storeId }));

  await prisma.mediaAsset.delete({ where: { id } });
  await audit(ctx, "media.delete", { type: "MediaAsset", id });
  return true;
}

async function removeObject(url: string, storeId: string) {
  if (url.startsWith("/uploads/")) {
    // Only paths inside this store's own upload directory are ever unlinked.
    const relative = path.normalize(url.replace(/^\/uploads\//, ""));
    if (!relative.startsWith(`${storeId}${path.sep}`) || relative.includes("..")) return;
    await unlink(path.join(process.cwd(), "public", "uploads", relative)).catch(() => undefined);
    return;
  }
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (supabaseUrl && url.startsWith(`${supabaseUrl}/storage/v1/object/public/`)) {
    const objectRef = url.slice(`${supabaseUrl}/storage/v1/object/public/`.length);
    if (!objectRef.split("/")[1]?.startsWith(storeId)) return;
    await fetch(`${supabaseUrl}/storage/v1/object/${objectRef}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      signal: AbortSignal.timeout(15_000),
    });
    return;
  }
  if (process.env.BLOB_READ_WRITE_TOKEN && /\.public\.blob\.vercel-storage\.com\//.test(url) && url.includes(`/media/${storeId}/`)) {
    const { del } = await import("@vercel/blob");
    await del(url);
  }
}

export async function updateMediaAlt(ctx: ServiceContext, id: string, alt: string) {
  authorize(ctx, "content:write");
  const asset = await prisma.mediaAsset.findFirst({ where: { id, storeId: ctx.storeId }, select: { id: true } });
  if (!asset) throw new ValidationError("That file no longer exists.");
  return prisma.mediaAsset.update({ where: { id }, data: { alt: alt.slice(0, 300) } });
}
