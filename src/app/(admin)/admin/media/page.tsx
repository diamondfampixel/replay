import type { Metadata } from "next";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { listMedia } from "@/lib/services/media";
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

  const storageMode =
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? "Supabase storage"
      : "local disk";

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Media"
        description={`${result.total} file${result.total === 1 ? "" : "s"} · stored on ${storageMode}`}
      />
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
