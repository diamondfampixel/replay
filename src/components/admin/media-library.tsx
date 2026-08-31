"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DemoTag, EmptyState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/admin/confirm";
import { DataToolbar, Pagination } from "@/components/admin/data-toolbar";
import { formatDate } from "@/lib/format";
import { deleteMediaAction, updateMediaAltAction } from "@/app/actions/media";
import { cn } from "@/lib/utils";

type Asset = {
  id: string;
  filename: string;
  url: string;
  alt: string | null;
  size: number;
  mimeType: string;
  isDemo: boolean;
  createdAt: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaLibrary({
  assets, total, page, pageCount, perPage, canWrite,
}: {
  assets: Asset[];
  total: number;
  page: number;
  pageCount: number;
  perPage: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = React.useState(false);
  const [selected, setSelected] = React.useState<Asset | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<Asset | null>(null);
  const [altDraft, setAltDraft] = React.useState<{ id: string; value: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  // The draft is keyed by asset, so selecting a different file shows its own
  // alt text without an effect resetting the field.
  const alt = altDraft && selected && altDraft.id === selected.id ? altDraft.value : selected?.alt ?? "";
  const setAlt = (value: string) => selected && setAltDraft({ id: selected.id, value });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) formData.append("file", file);
      const response = await fetch("/api/admin/media", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upload failed");
      toast.success(`${data.assets.length} file${data.assets.length === 1 ? "" : "s"} uploaded`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="overflow-hidden">
        <DataToolbar searchPlaceholder="Search filenames…">
          {canWrite && (
            <label>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => upload(event.target.files)}
              />
              <span
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-ink-900 px-3 text-[13px] font-medium text-white hover:bg-ink-800",
                  uploading && "pointer-events-none opacity-60",
                )}
              >
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                Upload
              </span>
            </label>
          )}
        </DataToolbar>

        {assets.length === 0 ? (
          <EmptyState
            icon={ImagePlus}
            title="No files yet"
            description="Upload product photography, banners and anything else your storefront needs."
          />
        ) : (
          <div
            className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (canWrite) upload(event.dataTransfer.files);
            }}
          >
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelected(asset)}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-md border-2 bg-ink-50",
                  selected?.id === asset.id ? "border-ink-900" : "border-transparent hover:border-ink-300",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt={asset.alt ?? ""} loading="lazy" className="size-full object-cover" />
                {asset.isDemo && (
                  <span className="absolute left-1 top-1">
                    <DemoTag label="Demo" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {total > perPage && (
          <Pagination page={page} pageCount={pageCount} total={total} perPage={perPage} />
        )}
      </Card>

      <Card className="h-fit">
        {selected ? (
          <div className="p-4">
            <div className="mb-3 overflow-hidden rounded-md border border-ink-200 bg-ink-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.url} alt={selected.alt ?? ""} className="aspect-square w-full object-contain" />
            </div>

            <p className="truncate text-[13px] font-medium text-ink-900">{selected.filename}</p>
            <dl className="mt-2 space-y-1 text-[12px] text-ink-500">
              <div className="flex justify-between"><dt>Size</dt><dd className="tabular">{formatBytes(selected.size)}</dd></div>
              <div className="flex justify-between"><dt>Type</dt><dd>{selected.mimeType}</dd></div>
              <div className="flex justify-between"><dt>Added</dt><dd>{formatDate(selected.createdAt)}</dd></div>
            </dl>

            <div className="mt-3 space-y-2">
              <Input
                value={alt}
                disabled={!canWrite}
                onChange={(event) => setAlt(event.target.value)}
                placeholder="Alt text"
                aria-label="Alt text"
                className="h-8 text-[12.5px]"
              />
              {canWrite && alt !== (selected.alt ?? "") && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  loading={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await updateMediaAltAction(selected.id, alt);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("Alt text saved");
                      router.refresh();
                    })
                  }
                >
                  Save alt text
                </Button>
              )}

              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(selected.url);
                  toast.success("URL copied");
                }}
              >
                <Copy />
                Copy URL
              </Button>

              {canWrite && (
                <Button size="sm" variant="dangerOutline" className="w-full" onClick={() => setConfirmDelete(selected)}>
                  <Trash2 />
                  Delete file
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-[13px] text-ink-500">
            Select a file to see its details.
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.filename}?`}
        description="Anywhere this file is used — a product image, a page section — will show a broken image until you replace it."
        confirmLabel="Delete file"
        destructive
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            if (!confirmDelete) return;
            const result = await deleteMediaAction(confirmDelete.id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("File deleted");
            setConfirmDelete(null);
            setSelected(null);
            router.refresh();
          })
        }
      />
    </div>
  );
}
