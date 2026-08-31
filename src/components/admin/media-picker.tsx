"use client";

import * as React from "react";
import { ImagePlus, Loader2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type MediaAssetLite = {
  id: string;
  filename: string;
  url: string;
  alt: string | null;
  size: number;
  createdAt: string;
};

async function uploadFiles(files: File[]): Promise<MediaAssetLite[]> {
  const formData = new FormData();
  for (const file of files) formData.append("file", file);
  const response = await fetch("/api/admin/media", { method: "POST", body: formData });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Upload failed");
  return data.assets as MediaAssetLite[];
}

/** Modal library + uploader. Returns the chosen image URLs to the caller. */
export function MediaLibraryDialog({
  open,
  onOpenChange,
  onSelect,
  multiple = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (urls: string[]) => void;
  multiple?: boolean;
}) {
  const [assets, setAssets] = React.useState<MediaAssetLite[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState("");

  const load = React.useCallback(async (search: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/media?q=${encodeURIComponent(search)}`);
      const data = await response.json();
      if (response.ok) setAssets(data.assets);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setSelected([]);
    load(query);
  }, [open, query, load]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded = await uploadFiles(Array.from(files));
      setAssets((prev) => [...uploaded, ...prev]);
      setSelected(multiple ? uploaded.map((a) => a.url) : [uploaded[0].url]);
      toast.success(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files…"
              className="h-8 max-w-56 text-[13px]"
            />
            <label className="ml-auto">
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => onFiles(event.target.files)}
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
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="skeleton aspect-square rounded-md" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[13px] text-ink-500">No files yet. Upload an image to get started.</p>
            </div>
          ) : (
            <div className="scroll-thin grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
              {assets.map((asset) => {
                const active = selected.includes(asset.url);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() =>
                      setSelected((prev) =>
                        multiple
                          ? active ? prev.filter((url) => url !== asset.url) : [...prev, asset.url]
                          : [asset.url],
                      )
                    }
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-md border-2 bg-ink-50",
                      active ? "border-ink-900" : "border-transparent hover:border-ink-300",
                    )}
                    title={asset.filename}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.url} alt={asset.alt ?? ""} className="size-full object-cover" loading="lazy" />
                    {active && (
                      <span className="absolute right-1 top-1 rounded-full bg-ink-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {multiple ? selected.indexOf(asset.url) + 1 : "✓"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!selected.length}
            onClick={() => {
              onSelect(selected);
              onOpenChange(false);
            }}
          >
            {multiple ? `Add ${selected.length || ""} image${selected.length === 1 ? "" : "s"}` : "Choose image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type EditableImage = { id?: string; url: string; alt?: string | null };

/** Reorderable product image strip with drag-to-reorder and alt text editing. */
export function ImageManager({
  images,
  onChange,
}: {
  images: EditableImage[];
  onChange: (images: EditableImage[]) => void;
}) {
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [uploading, setUploading] = React.useState(false);

  function move(from: number, to: number) {
    if (from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  async function onDrop(event: React.DragEvent) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await uploadFiles(files);
      onChange([...images, ...uploaded.map((asset) => ({ url: asset.url, alt: asset.alt }))]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      >
        {images.map((image, index) => (
          <div
            key={`${image.url}-${index}`}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.stopPropagation();
              if (dragIndex !== null) move(dragIndex, index);
              setDragIndex(null);
            }}
            className="group relative aspect-square cursor-move overflow-hidden rounded-md border border-ink-200 bg-ink-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.alt ?? ""} className="size-full object-cover" />
            {index === 0 && (
              <span className="absolute left-1 top-1 rounded bg-ink-900/85 px-1.5 py-0.5 text-[10px] font-medium text-white">
                Primary
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(images.filter((_, i) => i !== index))}
              className="absolute right-1 top-1 rounded bg-white/90 p-1 text-ink-600 opacity-0 transition-opacity hover:text-[var(--color-signal-negative)] group-hover:opacity-100"
              aria-label="Remove image"
            >
              <X className="size-3" />
            </button>
            <input
              value={image.alt ?? ""}
              onChange={(event) =>
                onChange(images.map((img, i) => (i === index ? { ...img, alt: event.target.value } : img)))
              }
              placeholder="Alt text"
              className="absolute inset-x-0 bottom-0 border-0 bg-white/92 px-1.5 py-1 text-[11px] outline-none placeholder:text-ink-400"
              aria-label={`Alt text for image ${index + 1}`}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-ink-300 bg-white text-ink-400 hover:border-ink-400 hover:text-ink-600"
        >
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          <span className="text-[11.5px]">Add image</span>
        </button>
      </div>

      <p className="mt-2 text-[11.5px] text-ink-400">
        Drag to reorder — the first image is used as the primary. You can also drop files here.
      </p>

      <MediaLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        multiple
        onSelect={(urls) => onChange([...images, ...urls.map((url) => ({ url, alt: "" }))])}
      />
    </div>
  );
}

/** Single-image field used by page sections and collections. */
export function ImageField({
  value,
  onChange,
  label = "Image",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      {value ? (
        <div className="relative overflow-hidden rounded-md border border-ink-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-28 w-full object-cover" />
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-ink-700 hover:bg-white"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded bg-white/90 p-1 text-ink-600 hover:text-[var(--color-signal-negative)]"
              aria-label="Remove image"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-ink-300 text-ink-400 hover:border-ink-400 hover:text-ink-600"
        >
          <ImagePlus className="size-4" />
          <span className="text-[12px]">Choose {label.toLowerCase()}</span>
        </button>
      )}
      <MediaLibraryDialog open={open} onOpenChange={setOpen} onSelect={(urls) => onChange(urls[0] ?? null)} />
    </div>
  );
}
