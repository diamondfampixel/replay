"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown, ArrowLeft, ArrowUp, Camera, Copy, Eye, EyeOff, GripVertical, History, Monitor, Palette, Plus, Redo2,
  RotateCcw, Search, Smartphone, Sparkles, Tablet, Trash2, Undo2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/admin/confirm";
import { SectionSettings, type EditorMode } from "@/components/admin/section-settings";
import {
  SECTION_CATEGORIES, SECTION_META, SECTION_TYPES, sectionDefaultsFor, summariseSection, type SectionType,
} from "@/lib/storefront/sections";
import type { ResolvedTheme } from "@/lib/storefront/theme";
import { cn } from "@/lib/utils";
import { discardDraftAction, publishPageAction, regenerateHomepageAction, saveDraftAction } from "@/app/actions/store";
import { createSnapshotAction, deleteSnapshotAction, restoreSnapshotAction } from "@/app/actions/design";

export type EditorSection = {
  id: string;
  type: SectionType;
  visible: boolean;
  config: Record<string, unknown>;
};

export type EditorTheme = Pick<ResolvedTheme, "dna" | "direction" | "motion" | "cards"> & { schemes: Array<{ id: string; name: string }> };
export type EditorSnapshot = { id: string; label: string; source: string; createdAt: string; pageCount: number };

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "834px", mobile: "390px" };

/** Beginner/advanced preference, persisted per browser and hydration-safe. */
const MODE_KEY = "halyard.editor.mode";
function useStoredMode(): EditorMode {
  return React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener("halyard:editor-mode", onChange);
      window.addEventListener("storage", onChange);
      return () => { window.removeEventListener("halyard:editor-mode", onChange); window.removeEventListener("storage", onChange); };
    },
    () => { try { return window.localStorage.getItem(MODE_KEY) === "advanced" ? "advanced" : "simple"; } catch { return "simple"; } },
    () => "simple",
  );
}

/** Undo/redo over the section list. Every edit is one step; capped at 80. */
function useHistory<T>(initial: T) {
  const [state, setState] = React.useState<{ present: T; past: T[]; future: T[] }>({ present: initial, past: [], future: [] });
  const set = React.useCallback((next: T) => setState((s) => ({ present: next, past: [...s.past.slice(-79), s.present], future: [] })), []);
  const undo = React.useCallback(() => setState((s) => (s.past.length ? { present: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.present, ...s.future] } : s)), []);
  const redo = React.useCallback(() => setState((s) => (s.future.length ? { present: s.future[0], past: [...s.past, s.present], future: s.future.slice(1) } : s)), []);
  const reset = React.useCallback((next: T) => setState({ present: next, past: [], future: [] }), []);
  return { value: state.present, set, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

export function StoreEditor({
  pageId, pageTitle, storeSlug, initialSections, hasUnpublishedChanges, collections, products, aiConfigured, canWrite, theme, snapshots: initialSnapshots, premiumUnlocked = false,
}: {
  /** Premium-only sections may be added (the store has a premium theme). */
  premiumUnlocked?: boolean;
  pageId: string;
  pageTitle: string;
  storeSlug: string;
  initialSections: EditorSection[];
  hasUnpublishedChanges: boolean;
  collections: Array<{ slug: string; title: string }>;
  products: Array<{ id: string; title: string }>;
  aiConfigured: boolean;
  canWrite: boolean;
  theme: EditorTheme;
  snapshots: EditorSnapshot[];
}) {
  const router = useRouter();
  const history = useHistory(initialSections);
  const sections = history.value;
  const [selectedId, setSelectedId] = React.useState<string | null>(initialSections[0]?.id ?? null);
  const [device, setDevice] = React.useState<Device>("desktop");
  const mode = useStoredMode();
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [confirmPublish, setConfirmPublish] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [previewKey, setPreviewKey] = React.useState(0);
  const [staged, setStaged] = React.useState(hasUnpublishedChanges);
  const [snapshots, setSnapshots] = React.useState(initialSnapshots);
  const frame = React.useRef<HTMLIFrameElement>(null);

  const switchMode = (next: EditorMode) => {
    try { window.localStorage.setItem(MODE_KEY, next); } catch { /* private mode */ }
    window.dispatchEvent(new Event("halyard:editor-mode"));
  };

  const idPrefix = React.useId();
  const idCounter = React.useRef(0);
  const nextDraftId = () => `draft-${idPrefix}-${idCounter.current++}`;
  const selected = sections.find((section) => section.id === selectedId) ?? null;

  function mutate(next: EditorSection[]) {
    history.set(next);
    setDirty(true);
  }

  const save = React.useCallback(async (options: { silent?: boolean } = {}) => {
    setSaving(true);
    try {
      const result = await saveDraftAction(pageId, sections);
      if (!result.ok) { toast.error(result.error); return false; }
      setDirty(false);
      setStaged(true);
      setPreviewKey((key) => key + 1);
      if (!options.silent) toast.success("Draft saved — not yet live");
      return true;
    } finally {
      setSaving(false);
    }
  }, [pageId, sections]);

  // Autosave to the draft so the preview keeps up without publishing anything.
  React.useEffect(() => {
    if (!dirty || !canWrite) return;
    const timer = setTimeout(() => save({ silent: true }), 900);
    return () => clearTimeout(timer);
  }, [dirty, sections, save, canWrite]);

  // Undo / redo keyboard shortcuts (outside inputs).
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) history.redo(); else history.undo();
      setDirty(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history]);

  // Click-to-select from the preview iframe (same origin only).
  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.data || typeof event.data !== "object") return;
      if (event.data.type === "halyard:select" && typeof event.data.id === "string") setSelectedId(event.data.id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  const highlight = (id: string | null, scroll: boolean) => {
    frame.current?.contentWindow?.postMessage({ type: "halyard:highlight", id, scroll }, window.location.origin);
  };
  React.useEffect(() => { highlight(selectedId, false); }, [selectedId, previewKey]);

  async function publish() {
    setPublishing(true);
    try {
      if (dirty) await save({ silent: true });
      const result = await publishPageAction(pageId);
      if (!result.ok) { toast.error(result.error); return; }
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
    const section: EditorSection = { id: nextDraftId(), type, visible: true, config: sectionDefaultsFor(type, theme) };
    const at = selected ? sections.findIndex((s) => s.id === selected.id) + 1 : sections.length;
    const next = [...sections];
    next.splice(at, 0, section);
    mutate(next);
    setSelectedId(section.id);
    setAddOpen(false);
  }

  const selectedIndex = selected ? sections.findIndex((s) => s.id === selected.id) : -1;

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

        {canWrite && (
          <div className="ml-2 flex rounded-md border border-ink-200 p-0.5">
            <ToolbarButton label="Undo (⌘Z)" disabled={!history.canUndo} onClick={() => { history.undo(); setDirty(true); }}><Undo2 className="size-3.5" /></ToolbarButton>
            <ToolbarButton label="Redo (⇧⌘Z)" disabled={!history.canRedo} onClick={() => { history.redo(); setDirty(true); }}><Redo2 className="size-3.5" /></ToolbarButton>
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-ink-200 p-0.5">
            {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
              <button key={d} type="button" onClick={() => setDevice(d)} className={cn("rounded px-2 py-1", device === d ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-800")} aria-label={`${d} preview`} aria-pressed={device === d}>
                {d === "desktop" ? <Monitor className="size-3.5" /> : d === "tablet" ? <Tablet className="size-3.5" /> : <Smartphone className="size-3.5" />}
              </button>
            ))}
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/settings/design"><Palette />Design system</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
            <History />
            History
          </Button>
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
              <Button size="sm" variant="secondary" onClick={() => save()} loading={saving} disabled={!dirty}>Save draft</Button>
              <Button size="sm" variant="primary" onClick={() => setConfirmPublish(true)}>
                <Upload />
                Publish
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_1fr_320px]">
        <aside className="scroll-thin hidden overflow-y-auto border-r border-ink-200 bg-white p-3 lg:block">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Structure</h2>
            {canWrite && (
              <button type="button" onClick={() => setAddOpen(true)} className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800" aria-label="Add section">
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
                onDrop={() => { if (dragIndex !== null) move(dragIndex, index); setDragIndex(null); }}
                className={cn(
                  "group flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[12.5px] transition-colors",
                  selectedId === section.id ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100",
                  !section.visible && "opacity-50",
                )}
              >
                {canWrite && <GripVertical className="size-3 shrink-0 cursor-grab opacity-40" />}
                <button type="button" onClick={() => { setSelectedId(section.id); highlight(section.id, true); }} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-medium">{SECTION_META[section.type].label}</span>
                  <span className={cn("block truncate text-[11px]", selectedId === section.id ? "text-white/60" : "text-ink-400")}>
                    {summariseSection(section.type, section.config) || "—"}
                  </span>
                </button>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => mutate(sections.map((s) => (s.id === section.id ? { ...s, visible: !s.visible } : s)))}
                    className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
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
          <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
            Click a section in the preview to select it. Drag to reorder. ⌘Z undoes.
          </p>
        </aside>

        <main className="min-h-0 overflow-hidden bg-ink-100 p-4">
          <div className="mx-auto h-full overflow-hidden rounded-lg border border-ink-300 bg-white shadow-sm transition-all" style={{ maxWidth: DEVICE_WIDTH[device] }}>
            <iframe ref={frame} key={previewKey} src={`/s/${storeSlug}/preview?page=${pageId}`} title="Storefront preview" className="size-full" onLoad={() => highlight(selectedId, false)} />
          </div>
        </main>

        <aside className="scroll-thin hidden overflow-y-auto border-l border-ink-200 bg-white p-4 lg:block">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex rounded-md border border-ink-200 p-0.5 text-[11px]">
              {(["simple", "advanced"] as EditorMode[]).map((m) => (
                <button key={m} type="button" onClick={() => switchMode(m)} aria-pressed={mode === m} className={cn("rounded px-2 py-0.5 capitalize", mode === m ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-800")}>{m}</button>
              ))}
            </div>
            {selected && canWrite && (
              <div className="flex gap-0.5">
                <ToolbarButton label="Move up" disabled={selectedIndex <= 0} onClick={() => move(selectedIndex, selectedIndex - 1)}><ArrowUp className="size-3.5" /></ToolbarButton>
                <ToolbarButton label="Move down" disabled={selectedIndex >= sections.length - 1} onClick={() => move(selectedIndex, selectedIndex + 1)}><ArrowDown className="size-3.5" /></ToolbarButton>
                <ToolbarButton
                  label="Duplicate section"
                  onClick={() => {
                    const copy = { ...selected, id: nextDraftId(), config: JSON.parse(JSON.stringify(selected.config)) };
                    const next = [...sections];
                    next.splice(selectedIndex + 1, 0, copy);
                    mutate(next);
                    setSelectedId(copy.id);
                  }}
                >
                  <Copy className="size-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  label="Delete section"
                  danger
                  onClick={() => {
                    const next = sections.filter((s) => s.id !== selected.id);
                    mutate(next);
                    setSelectedId(next[Math.min(selectedIndex, next.length - 1)]?.id ?? null);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </ToolbarButton>
              </div>
            )}
          </div>

          {selected ? (
            <>
              <h2 className="mb-2 text-[13px] font-semibold text-ink-900">{SECTION_META[selected.type].label}</h2>
              <fieldset disabled={!canWrite} className="space-y-3">
                <SectionSettings
                  type={selected.type}
                  config={selected.config}
                  collections={collections}
                  products={products}
                  schemes={theme.schemes}
                  mode={mode}
                  onChange={(config) => mutate(sections.map((s) => (s.id === selected.id ? { ...s, config } : s)))}
                />
              </fieldset>
            </>
          ) : (
            <p className="py-8 text-center text-[13px] text-ink-500">Select a section to edit it.</p>
          )}
        </aside>
      </div>

      <AddSectionDialog open={addOpen} onOpenChange={setAddOpen} onPick={addSection}  premiumUnlocked={premiumUnlocked} />

      <GenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} onGenerated={() => { setGenerateOpen(false); router.refresh(); }} />

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        snapshots={snapshots}
        canWrite={canWrite}
        onCreate={async (label) => {
          const result = await createSnapshotAction(label);
          if (!result.ok) { toast.error(result.error); return; }
          setSnapshots((list) => [result.data, ...list]);
          toast.success("Snapshot saved");
        }}
        onRestore={async (id) => {
          const result = await restoreSnapshotAction(id);
          if (!result.ok) { toast.error(result.error); return; }
          toast.success(result.message ?? "Restored");
          setHistoryOpen(false);
          router.refresh();
        }}
        onDelete={async (id) => {
          const result = await deleteSnapshotAction(id);
          if (!result.ok) { toast.error(result.error); return; }
          setSnapshots((list) => list.filter((s) => s.id !== id));
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
          if (!result.ok) { toast.error(result.error); return; }
          toast.success("Draft discarded");
          setConfirmDiscard(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function ToolbarButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cn("rounded p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30", danger && "hover:text-[var(--color-signal-negative)]")}>
      {children}
    </button>
  );
}

function AddSectionDialog({ open, onOpenChange, onPick, premiumUnlocked }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (type: SectionType) => void; premiumUnlocked: boolean }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const q = query.trim().toLowerCase();
  const list = SECTION_TYPES.filter((type) => {
    const meta = SECTION_META[type];
    if (category !== "all" && meta.category !== category) return false;
    if (!q) return true;
    return `${meta.label} ${meta.description} ${meta.keywords ?? ""} ${type}`.toLowerCase().includes(q);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add a section</DialogTitle>
          <DialogDescription>
            New sections arrive already matched to your store&apos;s design DNA. Each has several compositions you can switch later.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sections…" className="pl-8" autoFocus />
            </div>
            <div className="flex flex-wrap gap-1">
              {[{ id: "all", label: "All" }, ...SECTION_CATEGORIES].map((c) => (
                <button key={c.id} type="button" onClick={() => setCategory(c.id)} aria-pressed={category === c.id} className={cn("rounded-full border px-2.5 py-1 text-[12px]", category === c.id ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 text-ink-600 hover:border-ink-400")}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="scroll-thin grid max-h-[55vh] gap-2 overflow-y-auto sm:grid-cols-2">
            {list.map((type) => {
              const meta = SECTION_META[type];
              const locked = Boolean(meta.premium) && !premiumUnlocked;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => { if (!locked) onPick(type); }}
                  aria-disabled={locked || undefined}
                  title={locked ? "Included with any premium theme" : undefined}
                  className={cn("rounded-md border px-3 py-2.5 text-left transition-colors", locked ? "cursor-not-allowed border-dashed border-ink-200 bg-ink-50/60" : "border-ink-200 hover:border-ink-400 hover:bg-ink-50")}
                >
                  <p className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
                    {meta.label}
                    {meta.premium && <span className="rounded-full bg-ink-900 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-white">Premium</span>}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-500">{meta.description}</p>
                  {locked ? (
                    <p className="mt-1 text-[11px] text-ink-400">Comes with any premium theme from the Themes gallery.</p>
                  ) : (
                    meta.layouts && <p className="mt-1 text-[11px] text-ink-400">{meta.layouts.length} compositions</p>
                  )}
                </button>
              );
            })}
            {list.length === 0 && <p className="col-span-full py-6 text-center text-[13px] text-ink-500">No sections match.</p>}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ open, onOpenChange, snapshots, canWrite, onCreate, onRestore, onDelete }: {
  open: boolean; onOpenChange: (open: boolean) => void; snapshots: EditorSnapshot[]; canWrite: boolean;
  onCreate: (label: string) => Promise<void>; onRestore: (id: string) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  const [label, setLabel] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<EditorSnapshot | null>(null);
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Design history</DialogTitle>
            <DialogDescription>
              A snapshot captures your whole design — theme and homepage sections. One is taken automatically before every AI redesign, so any change is reversible.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {canWrite && (
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setPending("new");
                  try { await onCreate(label || "Manual snapshot"); setLabel(""); } finally { setPending(null); }
                }}
              >
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. Before spring refresh" className="flex-1" />
                <Button type="submit" size="sm" variant="secondary" loading={pending === "new"}><Camera />Save snapshot</Button>
              </form>
            )}
            <ul className="divide-y divide-ink-200 rounded-md border border-ink-200">
              {snapshots.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-500">No snapshots yet.</li>}
              {snapshots.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink-900">{s.label}</p>
                    <p className="text-[11.5px] text-ink-500">
                      {new Date(s.createdAt).toLocaleString()} · <span className="capitalize">{s.source === "ai" ? "before AI change" : s.source}</span>
                    </p>
                  </div>
                  {canWrite && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setConfirm(s)}>Restore</Button>
                      <button type="button" onClick={async () => { setPending(s.id); try { await onDelete(s.id); } finally { setPending(null); } }} className="rounded p-1.5 text-ink-400 hover:text-[var(--color-signal-negative)]" aria-label="Delete snapshot">
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </DialogBody>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title={`Restore "${confirm?.label}"?`}
        description="Your theme and live homepage sections are replaced by this snapshot. The current state is saved first, so you can come back."
        confirmLabel="Restore"
        loading={pending === confirm?.id}
        onConfirm={async () => { if (!confirm) return; setPending(confirm.id); try { await onRestore(confirm.id); } finally { setPending(null); setConfirm(null); } }}
      />
    </>
  );
}

function GenerateDialog({ open, onOpenChange, onGenerated }: { open: boolean; onOpenChange: (open: boolean) => void; onGenerated: () => void }) {
  const [focus, setFocus] = React.useState("");
  const [pending, setPending] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate a homepage with AI</DialogTitle>
          <DialogDescription>
            The assistant composes a full set of sections from your store profile, catalog and design DNA. It is
            staged as a draft — nothing reaches your live store until you publish.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="Anything to emphasise?" htmlFor="focus" hint="Optional. For example: free shipping, a seasonal launch, the repair programme.">
            <Input id="focus" value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="Lead with free shipping over $75" />
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
                if (!result.ok) { toast.error(result.error); return; }
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
