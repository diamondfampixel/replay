import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { deleteMedia, mediaStorage, mediaStorageNeedsSetup, sniffImageType, updateMediaAlt, uploadMedia } from "@/lib/services/media";
import type { ServiceContext } from "@/lib/services/context";

let a: { ctx: ServiceContext; organizationId: string; userId: string };
let b: { ctx: ServiceContext; organizationId: string; userId: string };

// Smallest valid files of each kind (no real image content needed to test the gate).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x10, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(8)]);

function file(bytes: Buffer, name: string, type: string) {
  return new File([new Uint8Array(bytes)], name, { type });
}

beforeAll(async () => {
  const one = await createTestStore("media-a");
  const two = await createTestStore("media-b");
  a = { ctx: one.ctx, organizationId: one.organization.id, userId: one.user.id };
  b = { ctx: two.ctx, organizationId: two.organization.id, userId: two.user.id };
});

afterAll(async () => {
  await cleanupTestStore(a.organizationId, a.userId);
  await cleanupTestStore(b.organizationId, b.userId);
});

describe("image validation", () => {
  it("recognises real image bytes and rejects everything else", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(GIF)).toBe("image/gif");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(Buffer.from("<svg onload=alert(1)></svg>"))).toBeNull();
    expect(sniffImageType(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffImageType(Buffer.alloc(4))).toBeNull();
  });

  it("refuses a file whose declared type lies about its bytes", async () => {
    await expect(uploadMedia(a.ctx, file(Buffer.from("<html><script>x</script></html>"), "logo.png", "image/png"))).rejects.toThrow(/doesn't look like an image/);
  });

  it("refuses SVG, unsupported types, empty and oversized files with plain messages", async () => {
    await expect(uploadMedia(a.ctx, file(Buffer.from("<svg/>"), "logo.svg", "image/svg+xml"))).rejects.toThrow(/SVG files aren't supported yet/);
    await expect(uploadMedia(a.ctx, file(Buffer.from("%PDF-1.4"), "menu.pdf", "application/pdf"))).rejects.toThrow(/Unsupported file type/);
    await expect(uploadMedia(a.ctx, file(Buffer.alloc(0), "empty.png", "image/png"))).rejects.toThrow(/empty/);
    const huge = new File([new Uint8Array(1)], "huge.png", { type: "image/png" });
    Object.defineProperty(huge, "size", { value: 9 * 1024 * 1024 });
    await expect(uploadMedia(a.ctx, huge)).rejects.toThrow(/limit is 8MB/);
  });

  it("stores a valid image under the store's own path with the sniffed type, and sanitises the name", async () => {
    const asset = await uploadMedia(a.ctx, file(PNG, "../../etc/My Logo (final).PNG", "image/jpeg"), "Logo");
    expect(asset.mimeType).toBe("image/png");
    expect(asset.filename).toMatch(/^etc-my-logo-final-[0-9a-f]{8}\.png$/);
    expect(asset.url.startsWith(`/uploads/${a.ctx.storeId}/`)).toBe(true);
    expect(asset.alt).toBe("Logo");
  });
});

describe("tenant ownership", () => {
  it("another store cannot rename or delete this store's media", async () => {
    const asset = await uploadMedia(a.ctx, file(GIF, "pixel.gif", "image/gif"));
    await expect(updateMediaAlt(b.ctx, asset.id, "hijacked")).rejects.toThrow(/no longer exists/);
    await expect(deleteMedia(b.ctx, asset.id)).rejects.toThrow(/no longer exists/);
    const still = await testDb.mediaAsset.findUnique({ where: { id: asset.id } });
    expect(still?.alt).toBeNull();
    await deleteMedia(a.ctx, asset.id);
    expect(await testDb.mediaAsset.findUnique({ where: { id: asset.id } })).toBeNull();
  });

  it("only content:write may upload", async () => {
    await expect(uploadMedia({ ...a.ctx, role: "ANALYST" }, file(PNG, "x.png", "image/png"))).rejects.toThrow(/content:write/);
  });
});

describe("durable storage", () => {
  it("reports the provider and refuses uploads in production without one", async () => {
    expect(mediaStorage().provider).toBe("local");
    expect(mediaStorageNeedsSetup()).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(mediaStorageNeedsSetup()).toBe(true);
      await expect(uploadMedia(a.ctx, file(PNG, "x.png", "image/png"))).rejects.toThrow(/storage isn't connected/);
      process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_not_real";
      expect(mediaStorage()).toMatchObject({ provider: "vercel-blob", durable: true });
      expect(mediaStorageNeedsSetup()).toBe(false);
    } finally {
      delete process.env.BLOB_READ_WRITE_TOKEN;
      vi.unstubAllEnvs();
    }
  });
});
