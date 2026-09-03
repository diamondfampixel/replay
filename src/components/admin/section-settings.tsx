"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { ImageField } from "@/components/admin/media-picker";
import { SECTION_META, type SectionType } from "@/lib/storefront/sections";
import { DESIGN_FIELDS, SECTION_FIELDS, type FieldSpec } from "@/lib/storefront/section-fields";
import { cn } from "@/lib/utils";

type Config = Record<string, unknown>;
export type EditorMode = "simple" | "advanced";

/**
 * Editing form for one section, generated from the declarative field specs.
 * Three tabs: Content (copy, media, blocks), Layout (composition + layout
 * knobs) and Design (the shared per-section design overrides). Simple mode
 * hides the advanced fields and the Design tab so a beginner sees only what
 * matters.
 */
export function SectionSettings({
  type, config, onChange, collections, products, schemes, mode,
}: {
  type: SectionType;
  config: Config;
  onChange: (config: Config) => void;
  collections: Array<{ slug: string; title: string }>;
  products: Array<{ id: string; title: string }>;
  schemes: Array<{ id: string; name: string }>;
  mode: EditorMode;
}) {
  const meta = SECTION_META[type];
  const fields = SECTION_FIELDS[type].filter((f) => mode === "advanced" || !f.advanced);
  const content = fields.filter((f) => (f.group ?? "content") === "content");
  const layout = fields.filter((f) => f.group === "layout");
  const design = (config.design ?? {}) as Config;
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value, ...(key === "media" ? { imageUrl: (value as { url?: string | null })?.url ?? null } : {}) });
  const setDesign = (key: string, value: unknown) => onChange({ ...config, design: { ...design, [key]: value } });
  const ctx = { collections, products, config };

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-ink-500">{meta.description}</p>
      <Tabs defaultValue="content">
        <TabsList className="w-full">
          <TabsTrigger value="content" className="flex-1">Content</TabsTrigger>
          {(meta.layouts || layout.length > 0) && <TabsTrigger value="layout" className="flex-1">Layout</TabsTrigger>}
          {mode === "advanced" && <TabsTrigger value="design" className="flex-1">Design</TabsTrigger>}
        </TabsList>
        <TabsContent value="content" className="space-y-3.5 pt-3">
          {content.map((f) => <FieldControl key={f.key} field={f} value={config[f.key]} onChange={(v) => set(f.key, v)} ctx={ctx} />)}
          {content.length === 0 && <p className="text-[12px] text-ink-400">This section has no content fields.</p>}
        </TabsContent>
        <TabsContent value="layout" className="space-y-3.5 pt-3">
          {meta.layouts && (
            <div>
              <Label>Composition</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {meta.layouts.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => set("layout", l.id)}
                    aria-pressed={config.layout === l.id}
                    className={cn("rounded-md border px-2.5 py-2 text-left text-[12px] transition-colors", config.layout === l.id ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 text-ink-700 hover:border-ink-400")}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {layout.map((f) => <FieldControl key={f.key} field={f} value={config[f.key]} onChange={(v) => set(f.key, v)} ctx={ctx} />)}
        </TabsContent>
        <TabsContent value="design" className="space-y-3.5 pt-3">
          <p className="text-[11.5px] text-ink-500">Bend this one section. Global colours, type and spacing live under Settings → Design.</p>
          {DESIGN_FIELDS.map((f) => (
            <React.Fragment key={f.key}>
              <FieldControl field={f} value={design[f.key]} onChange={(v) => setDesign(f.key, v)} ctx={ctx} />
              {f.key === "scheme" && design.scheme === "custom" && (
                <Field label="Custom scheme" htmlFor="customScheme">
                  <Select id="customScheme" value={String(design.customScheme ?? "")} onChange={(e) => setDesign("customScheme", e.target.value)}>
                    <option value="">Choose…</option>
                    {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                  {schemes.length === 0 && <p className="mt-1 text-[11.5px] text-ink-400">Create custom schemes under Settings → Design → Colours.</p>}
                </Field>
              )}
            </React.Fragment>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Ctx = { collections: Array<{ slug: string; title: string }>; products: Array<{ id: string; title: string }>; config: Config };

function FieldControl({ field, value, onChange, ctx }: { field: FieldSpec; value: unknown; onChange: (value: unknown) => void; ctx: Ctx }) {
  const id = React.useId();
  if (field.showIf && !field.showIf(ctx.config)) return null;
  const str = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";

  switch (field.type) {
    case "text":
    case "url":
      return (
        <Field label={field.label} htmlFor={id} hint={field.hint}>
          <Input id={id} value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.type === "url" ? "/shop" : undefined} />
        </Field>
      );
    case "textarea":
      return (
        <Field label={field.label} htmlFor={id} hint={field.hint}>
          <Textarea id={id} rows={field.rows ?? 3} value={str} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case "number":
      return (
        <Field label={field.label} htmlFor={id} hint={field.hint}>
          <Input id={id} type="number" min={field.min} max={field.max} value={typeof value === "number" ? value : ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
        </Field>
      );
    case "boolean":
      return (
        <label className="flex items-center justify-between gap-3 text-[12.5px] text-ink-700">
          <span>{field.label}</span>
          <Switch checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />
        </label>
      );
    case "select":
      return (
        <Field label={field.label} htmlFor={id} hint={field.hint}>
          <Select id={id} value={str} onChange={(e) => { const raw = e.target.value; const opt = field.options.find((o) => String(o.value) === raw); onChange(opt ? opt.value : raw); }}>
            {field.options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
          </Select>
        </Field>
      );
    case "media":
      return <MediaControl label={field.label} value={(value as Config | null) ?? null} onChange={onChange} hint={field.hint} />;
    case "collection":
      return (
        <Field label={field.label} htmlFor={id} hint={field.hint}>
          <Select id={id} value={str} onChange={(e) => onChange(e.target.value)}>
            <option value="">Choose a collection…</option>
            {ctx.collections.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
          </Select>
        </Field>
      );
    case "product":
      return (
        <Field label={field.label} htmlFor={id} hint={field.hint}>
          <Select id={id} value={str} onChange={(e) => onChange(e.target.value)}>
            <option value="">Choose a product…</option>
            {ctx.products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </Select>
        </Field>
      );
    case "collections":
    case "products": {
      const list = ctx[field.type === "collections" ? "collections" : "products"] as Array<{ slug?: string; id?: string; title: string }>;
      const keyOf = (item: { slug?: string; id?: string }) => (field.type === "collections" ? item.slug! : item.id!);
      const selected = (Array.isArray(value) ? value : []) as string[];
      return (
        <div>
          <Label>{field.label}</Label>
          <div className="scroll-thin max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-ink-200 p-2">
            {list.map((item) => {
              const k = keyOf(item);
              return (
                <label key={k} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[12.5px] hover:bg-ink-50">
                  <input type="checkbox" className="size-3.5 accent-[var(--color-pine-600)]" checked={selected.includes(k)} onChange={(e) => onChange(e.target.checked ? [...selected, k] : selected.filter((x) => x !== k))} />
                  <span className="truncate text-ink-700">{item.title}</span>
                </label>
              );
            })}
            {list.length === 0 && <p className="px-1 py-2 text-[12px] text-ink-400">Nothing to choose from yet.</p>}
          </div>
          {field.hint && <p className="mt-1 text-[11.5px] text-ink-400">{field.hint}</p>}
        </div>
      );
    }
    case "items":
      return <BlocksList field={field} items={(Array.isArray(value) ? value : []) as Config[]} onChange={onChange} ctx={ctx} />;
    default:
      return null;
  }
}

function MediaControl({ label, value, onChange, hint }: { label: string; value: Config | null; onChange: (v: Config) => void; hint?: string }) {
  const media = { url: null, alt: "", focalX: 50, focalY: 50, overlay: 0, mobileUrl: null, ...(value ?? {}) } as { url: string | null; alt: string; focalX: number; focalY: number; overlay: number; mobileUrl: string | null };
  const patch = (p: Partial<typeof media>) => onChange({ ...media, ...p });
  const [more, setMore] = React.useState(false);
  return (
    <div className="space-y-2">
      <Field label={label} hint={hint}>
        <ImageField value={media.url} onChange={(url) => patch({ url })} />
      </Field>
      {media.url && (
        <>
          <Field label="Alt text" htmlFor={`alt-${label}`} hint="Describe the image for screen readers and search.">
            <Input id={`alt-${label}`} value={media.alt} onChange={(e) => patch({ alt: e.target.value })} className="h-8 text-[12.5px]" />
          </Field>
          <button type="button" onClick={() => setMore((m) => !m)} className="text-[11.5px] text-ink-500 underline">{more ? "Hide" : "Focal point, overlay, mobile crop"}</button>
          {more && (
            <div className="space-y-2 rounded-md border border-ink-200 p-2.5">
              <div className="relative overflow-hidden rounded" style={{ aspectRatio: "16 / 9" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={media.url} alt="" className="size-full object-cover" style={{ objectPosition: `${media.focalX}% ${media.focalY}%` }} />
                <button
                  type="button"
                  className="absolute inset-0 cursor-crosshair"
                  aria-label="Set focal point"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    patch({ focalX: Math.round(((e.clientX - r.left) / r.width) * 100), focalY: Math.round(((e.clientY - r.top) / r.height) * 100) });
                  }}
                />
                <span className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${media.focalX}%`, top: `${media.focalY}%`, background: "rgba(14,124,102,.8)" }} />
              </div>
              <p className="text-[11px] text-ink-400">Click the image to set the focal point ({media.focalX}%, {media.focalY}%). Crops keep this point visible.</p>
              <Field label={`Darken overlay (${media.overlay}%)`} htmlFor={`ov-${label}`}>
                <input id={`ov-${label}`} type="range" min={0} max={90} value={media.overlay} onChange={(e) => patch({ overlay: Number(e.target.value) })} className="w-full accent-[var(--color-pine-600)]" />
              </Field>
              <Field label="Different image on phones" hint="Optional portrait crop.">
                <ImageField value={media.mobileUrl} onChange={(mobileUrl) => patch({ mobileUrl })} />
              </Field>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Blocks: typed repeatable items with add / remove / duplicate / reorder. */
function BlocksList({ field, items, onChange, ctx }: { field: Extract<FieldSpec, { type: "items" }>; items: Config[]; onChange: (items: Config[]) => void; ctx: Ctx }) {
  const blank = Object.fromEntries(field.fields.map((f) => [f.key, f.type === "media" ? { url: null, alt: "", focalX: 50, focalY: 50, overlay: 0, mobileUrl: null } : f.type === "select" ? f.options[0]?.value ?? "" : ""]));
  const max = field.max ?? 12;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="mb-0">{field.label} <span className="font-normal text-ink-400">({items.length}/{max})</span></Label>
        <Button size="sm" variant="ghost" disabled={items.length >= max} onClick={() => onChange([...items, { ...blank }])}>
          <Plus />
          Add {field.itemLabel.toLowerCase()}
        </Button>
      </div>
      {field.hint && <p className="mb-2 rounded-md border border-ink-200 bg-ink-50 px-2.5 py-2 text-[11.5px] text-ink-600">{field.hint}</p>}
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="rounded-md border border-dashed border-ink-300 px-3 py-3 text-center text-[12px] text-ink-400">No {field.itemLabel.toLowerCase()}s yet.</p>
        )}
        {items.map((item, index) => (
          <div key={index} className="rounded-md border border-ink-200 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{field.itemLabel} {index + 1}</span>
              <div className="flex gap-0.5">
                <IconButton label="Move up" onClick={() => move(index, index - 1)} disabled={index === 0}><ArrowUp className="size-3" /></IconButton>
                <IconButton label="Move down" onClick={() => move(index, index + 1)} disabled={index === items.length - 1}><ArrowDown className="size-3" /></IconButton>
                <IconButton label="Duplicate" onClick={() => { if (items.length >= max) return; const next = [...items]; next.splice(index + 1, 0, JSON.parse(JSON.stringify(item))); onChange(next); }} disabled={items.length >= max}><Copy className="size-3" /></IconButton>
                <IconButton label={`Remove ${field.itemLabel.toLowerCase()} ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))} danger><Trash2 className="size-3" /></IconButton>
              </div>
            </div>
            <div className="space-y-2">
              {field.fields.map((sub) => (
                <FieldControl key={sub.key} field={sub} value={item[sub.key]} onChange={(v) => onChange(items.map((entry, i) => (i === index ? { ...entry, [sub.key]: v } : entry)))} ctx={ctx} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cn("rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800 disabled:opacity-30", danger && "hover:text-[var(--color-signal-negative)]")}>
      {children}
    </button>
  );
}
