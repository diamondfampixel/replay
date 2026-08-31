"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Copy, Eye, EyeOff, GripVertical, Monitor, Plus, RotateCcw,
  Smartphone, Sparkles, Trash2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/admin/confirm";
import { SectionSettings } from "@/components/admin/section-settings";
import {
  SECTION_META, SECTION_TYPES, defaultSectionConfig, summariseSection, type SectionType,
} from "@/lib/storefront/sections";
import { cn } from "@/lib/utils";
import {
  discardDraftAction, publishPageAction, regenerateHomepageAction, saveDraftAction,
} from "@/app/actions/store";

export type EditorSection = {
  id: string;
  type: SectionType;
  visible: boolean;
  config: Record<string, unknown>;
};

export function StoreEditor({
  pageId,
  pageTitle,
  storeSlug,
  initialSections,
  hasUnpublishedChanges,
  collections,
  products,
  aiConfigured,
  canWrite,
}: {
  pageId: string;
  pageTitle: string;
  storeSlug: string;
  initialSections: EditorSection[];
  hasUnpublishedChanges: boolean;
  collections: Array<{ slug: string; title: string }>;
  products: Array<{ id: string; title: string }>;
  aiConfigured: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [sections, setSections] = React.useState(initialSections);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialSections[0]?.id ?? null);
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [confirmPublish, setConfirmPublish] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [previewKey, setPreviewKey] = React.useState(0);
  const [staged, setStaged] = React.useState(hasUnpublishedChanges);

  // Draft ids only need to be unique within this editing session; a counter
  // keeps them deterministic instead of reading the clock.
  const idPrefix = React.useId();
  const idCounter = React.useRef(0);
  const nextDraftId = () => `draft-${idPrefix}-${idCounter.current++}`;

  const selected = sections.find((section) => section.id === selectedId) ?? null;

  function mutate(next: EditorSection[]) {
    setSections(next);
    setDirty(true);
  }

  const save = React.useCallback(
    async (options: { silent?: boolean } = {}) => {
      setSaving(true);
      try {
        const result = await saveDraftAction(pageId, sections);
        if (!result.ok) {
          toast.error(result.error);
          return false;
        }
        setDirty(false);
        setStaged(true);
        setPreviewKey((key) => key + 1);
        if (!options.silent) toast.success("Draft saved — not yet live");
        return true;
      } finally {
        setSaving(false);
      }
    },
    [pageId, sections],
  );

  // Autosave to the draft so the preview keeps up without publishing anything.
  React.useEffect(() => {
    if (!dirty || !canWrite) return;
    const timer = setTimeout(() => save({ silent: true }), 900);
    return () => clearTimeout(timer);
  }, [dirty, sections, save, canWrite]);

  async function publish() {
    setPublishing(true);
    try {
      if (dirty) await save({ silent: true });
      const result = await publishPageAction(pageId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Published");
      setStaged(false);
      setConfirmPublish(false);
      setPreviewKey((key) => key + 1);
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    mutate(next);
  }

  function addSection(type: SectionType) {
    const section: EditorSection = {
      id: nextDraftId(),
      type,
      visible: true,
      config: defaultSectionConfig(type),
    };
    mutate([...sections, section]);
    setSelectedId(section.id);
    setAddOpen(false);
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-200 bg-white px-4 py-2.5">
        <Link href="/admin/store" className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-ink-900">
          <ArrowLeft className="size-3.5" />
          Store
        </Link>
        <span className="text-[13px] font-medium text-ink-900">{pageTitle}</span>
        {staged && <Badge tone="warning">Unpublished changes</Badge>}
        {dirty && <Badge tone="neutral">Saving…</Badge>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-ink-200 p-0.5">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={cn("rounded px-2 py-1", device === "desktop" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-800")}
              aria-label="Desktop preview"
              aria-pressed={device === "desktop"}
            >
              <Monitor className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={cn("rounded px-2 py-1", device === "mobile" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-800")}
              aria-label="Mobile preview"
              aria-pressed={device === "mobile"}
            >
              <Smartphone className="size-3.5" />
            </button>
          </div>

          {aiConfigured && canWrite && (
            <Button size="sm" variant="secondary" onClick={() => setGenerateOpen(true)}>
              <Sparkles className="text-pine-600" />
              Generate with AI
            </Button>
          )}
          {staged && canWrite && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDiscard(true)}>
              <RotateCcw />
              Discard draft
            </Button>
          )}
          {canWrite && (
            <>
              <Button size="sm" variant="secondary" onClick={() => save()} loading={saving} disabled={!dirty}>
                Save draft
              </Button>
              <Button size="sm" variant="primary" onClick={() => setConfirmPublish(true)}>
                <Upload />
                Publish
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[230px_1fr_300px]">
        <aside className="scroll-thin hidden overflow-y-auto border-r border-ink-200 bg-white p-3 lg:block">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Sections</h2>
            {canWrite && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800"
                aria-label="Add section"
              >
                <Plus className="size-3.5" />
              </button>
            )}
          </div>

          <ul className="space-y-1">
            {sections.map((section, index) => (
              <li
                key={section.id}
                draggable={canWrite}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, index);
                  setDragIndex(null);
                }}
                className={cn(
                  "group flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[12.5px] transition-colors",
                  selectedId === section.id ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100",
                  !section.visible && "opacity-50",
                )}
              >
                {canWrite && <GripVertical className="size-3 shrink-0 cursor-grab opacity-40" />}
                <button
                  type="button"
                  onClick={() => setSelectedId(section.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate font-medium">{SECTION_META[section.type].label}</span>
                  <span
                    className={cn(
                      "block truncate text-[11px]",
                      selectedId === section.id ? "text-white/60" : "text-ink-400",
                    )}
                  >
                    {summariseSection(section.type, section.config) || "—"}
                  </span>
                </button>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() =>
                      mutate(sections.map((s) => (s.id === section.id ? { ...s, visible: !s.visible } : s)))
                    }
                    className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={section.visible ? "Hide section" : "Show section"}
                  >
                    {section.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {canWrite && (
            <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setAddOpen(true)}>
              <Plus />
              Add section
            </Button>
          )}
        </aside>

        <main className="min-h-0 overflow-hidden bg-ink-100 p-4">
          <div
            className={cn(
              "mx-auto h-full overflow-hidden rounded-lg border border-ink-300 bg-white shadow-sm transition-all",
              device === "mobile" ? "max-w-[390px]" : "max-w-full",
            )}
          >
            <iframe
              key={previewKey}
              src={`/s/${storeSlug}/preview?page=${pageId}`}
              title="Storefront preview"
              className="size-full"
            />
          </div>
        </main>

        <aside className="scroll-thin hidden overflow-y-auto border-l border-ink-200 bg-white p-4 lg:block">
          {selected ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-ink-900">
                  {SECTION_META[selected.type].label}
                </h2>
                {canWrite && (
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const index = sections.findIndex((s) => s.id === selected.id);
                        const copy = { ...selected, id: nextDraftId() };
                        const next = [...sections];
                        next.splice(index + 1, 0, copy);
                        mutate(next);
                        setSelectedId(copy.id);
                      }}
                      className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-800"
                      aria-label="Duplicate section"
                      title="Duplicate"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = sections.filter((s) => s.id !== selected.id);
                        mutate(next);
                        setSelectedId(next[0]?.id ?? null);
                      }}
                      className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-[var(--color-signal-negative)]"
                      aria-label="Delete section"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <fieldset disabled={!canWrite} className="space-y-3">
                <SectionSettings
                  type={selected.type}
                  config={selected.config}
                  collections={collections}
                  products={products}
                  onChange={(config) =>
                    mutate(sections.map((s) => (s.id === selected.id ? { ...s, config } : s)))
                  }
                />
              </fieldset>
            </>
          ) : (
            <p className="py-8 text-center text-[13px] text-ink-500">
              Select a section to edit it.
            </p>
          )}
        </aside>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Add a section</DialogTitle>
            <DialogDescription>
              Sections are configuration, not code. Add one and edit it in the panel on the right.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-2 sm:grid-cols-2">
              {SECTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addSection(type)}
                  className="rounded-md border border-ink-200 px-3 py-2.5 text-left transition-colors hover:border-ink-400 hover:bg-ink-50"
                >
                  <p className="text-[13px] font-medium text-ink-900">{SECTION_META[type].label}</p>
                  <p className="mt-0.5 text-[12px] text-ink-500">{SECTION_META[type].description}</p>
                </button>
              ))}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <GenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={() => {
          setGenerateOpen(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title={`Publish ${pageTitle} to your live store?`}
        description="Visitors will see these sections immediately. Your draft becomes the live page."
        confirmLabel="Publish now"
        loading={publishing}
        onConfirm={publish}
      />

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard your unpublished changes?"
        description="The editor reverts to what is currently live. This cannot be undone."
        confirmLabel="Discard draft"
        destructive
        onConfirm={async () => {
          const result = await discardDraftAction(pageId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Draft discarded");
          setConfirmDiscard(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function GenerateDialog({
  open, onOpenChange, onGenerated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => void;
}) {
  const [focus, setFocus] = React.useState("");
  const [pending, setPending] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate a homepage with AI</DialogTitle>
          <DialogDescription>
            The assistant writes a full set of sections using your store profile and catalog. It is
            staged as a draft — nothing reaches your live store until you publish.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field
            label="Anything to emphasise?"
            htmlFor="focus"
            hint="Optional. For example: free shipping, a seasonal launch, the repair programme."
          >
            <Input
              id="focus"
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              placeholder="Lead with free shipping over $75"
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="brand"
            size="sm"
            loading={pending}
            onClick={async () => {
              setPending(true);
              try {
                const result = await regenerateHomepageAction({ focus: focus || undefined });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(result.message ?? "Generated");
                onGenerated();
              } finally {
                setPending(false);
              }
            }}
          >
            <Sparkles />
            Generate draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
