import type { Metadata } from "next";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { listMedia, mediaStorage, mediaStorageNeedsSetup } from "@/lib/services/media";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page";
import { MediaLibrary } from "@/components/admin/media-library";

export const metadata: Metadata = { title: "Media" };
export const dynamic = "force-dynamic";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const auth = await requireCapability("content:read");
  const ctx = await serviceContext();
  const params = await searchParams;

  const result = await listMedia(ctx, {
    page: Number(params.page ?? 1),
    q: params.q,
  });

  const storage = mediaStorage();
  const needsSetup = mediaStorageNeedsSetup();

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Media"
        description={`${result.total} file${result.total === 1 ? "" : "s"} · stored on ${storage.label}`}
      />
      {needsSetup && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900" role="status">
          <span className="font-semibold">Uploads are paused on this deployment.</span> Durable image storage
          is not connected yet, so new uploads would be lost on the next deploy. The Halyard team needs to
          connect Supabase Storage or Vercel Blob; existing files and everything else keep working.
        </div>
      )}
      <MediaLibrary
        assets={result.assets.map((asset) => ({
          id: asset.id,
          filename: asset.filename,
          url: asset.url,
          alt: asset.alt,
          size: asset.size,
          mimeType: asset.mimeType,
          isDemo: asset.isDemo,
          createdAt: asset.createdAt.toISOString(),
        }))}
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
        perPage={result.perPage}
        canWrite={can(auth.role, "content:write")}
      />
    </div>
  );
}
