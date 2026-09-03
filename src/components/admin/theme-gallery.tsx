"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Monitor, Search, Smartphone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/admin/confirm";
import { PageHeader } from "@/components/ui/page";
import { THEME_CATEGORIES, type ThemeCategory, type ThemeTier } from "@/lib/storefront/themes";
import { applyThemeAction } from "@/app/actions/themes";
import { cn } from "@/lib/utils";

export type GalleryTheme = {
  id: string; name: string; tier: ThemeTier; category: ThemeCategory; tags: ThemeCategory[]; tagline: string; description: string; features: string[];
  priceCents: number; owned: boolean; active: boolean; swatch: [string, string, string];
  vars: Record<string, string>; fontFamilies: Array<{ family: string; weights: number[] }>; cardStyle: string; heroLayout: string; sections: string[]; headerStyle: string; isDark: boolean;
};

const TIER_LABEL: Record<ThemeTier, string> = { included: "Included", standard: "Premium", premium: "Premium", highend: "Premium" };
const price = (cents: number) => (cents === 0 ? "Free" : `$${(cents / 100).toFixed(0)} one-time`);
const CATEGORY_LABEL: Record<ThemeCategory, string> = { fashion: "Fashion", streetwear: "Streetwear", editorial: "Editorial", minimal: "Minimal", bold: "Bold", playful: "Playful", food: "Food & drink", beauty: "Beauty", jewelry: "Jewellery", wellness: "Wellness", sports: "Sports", creator: "Creator", technology: "Technology", gaming: "Gaming", interior: "Interior", organic: "Organic", futuristic: "Futuristic", photography: "Photography", typography: "Typography", marketplace: "Marketplace" };

/**
 * The Halyard theme library. Cards are original CSS previews rendered from
 * each theme's real tokens; Preview renders the merchant's own store through
 * the theme without touching it; Apply snapshots the current design first.
 */
export function ThemeGallery({ themes, storeSlug, canWrite, canBuy, paymentsConfigured, purchaseState }: {
  themes: GalleryTheme[]; storeSlug: string; canWrite: boolean; canBuy: boolean; paymentsConfigured: boolean; purchaseState: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"all" | "included" | "premium">("all");
  const [category, setCategory] = React.useState<ThemeCategory | "all">("all");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<GalleryTheme | null>(null);
  const [confirm, setConfirm] = React.useState<GalleryTheme | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [buying, setBuying] = React.useState(false);

  React.useEffect(() => {
    if (purchaseState === "success") toast.success("Purchase complete — the theme is yours to apply.");
    if (purchaseState === "cancelled") toast("Checkout cancelled. Nothing was charged.");
  }, [purchaseState]);

  const q = query.trim().toLowerCase();
  const list = themes.filter((t) => (filter === "all" || (filter === "included" ? t.tier === "included" : t.tier !== "included")) && (category === "all" || t.category === category || t.tags.includes(category)) && (!q || `${t.name} ${t.tagline} ${t.description} ${t.tags.join(" ")}`.toLowerCase().includes(q)));
  const usedCategories = THEME_CATEGORIES.filter((c) => themes.some((t) => t.category === c || t.tags.includes(c)));

  async function apply(theme: GalleryTheme) {
    setApplying(true);
    try {
      const result = await applyThemeAction(theme.id);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(result.message ?? "Applied");
      setConfirm(null); setSelected(null);
      router.refresh();
    } finally { setApplying(false); }
  }
  async function buy(theme: GalleryTheme) {
    setBuying(true);
    try {
      const response = await fetch("/api/themes/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ themeId: theme.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) { toast.error(data.error ?? "Could not start checkout."); return; }
      window.location.href = data.url;
    } finally { setBuying(false); }
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        title="Themes"
        description="Starting designs built on the same composable system as the editor. Included themes are free on every plan; premium themes are optional one-time purchases. Every theme stays fully editable after you apply it."
        actions={<Button asChild size="sm" variant="secondary"><Link href="/admin/store/editor">Open editor</Link></Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-ink-200 p-0.5 text-[12.5px]">
          {(["all", "included", "premium"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn("rounded px-3 py-1 capitalize", filter === f ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900")}>{f === "all" ? "All" : f === "included" ? "Included" : "Premium"}</button>
          ))}
        </div>
        <div className="relative min-w-52">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search themes…" className="pl-8" />
        </div>
        <span className="ml-auto text-[12.5px] text-ink-500">{list.length} of {themes.length} themes · {themes.filter((t) => t.tier === "included").length} included · {themes.filter((t) => t.tier !== "included").length} premium</span>
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>All styles</CategoryChip>
        {usedCategories.map((c) => <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)}>{CATEGORY_LABEL[c]}</CategoryChip>)}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((theme) => (
          <button key={theme.id} type="button" onClick={() => setSelected(theme)} className="group overflow-hidden rounded-lg border border-ink-200 bg-white text-left transition-colors hover:border-ink-400">
            <ThemeSwatch theme={theme} />
            <div className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-ink-900">{theme.name}</p>
                <div className="flex items-center gap-1.5">
                  {theme.active && <Badge tone="success">Active</Badge>}
                  {theme.tier !== "included" && theme.owned && !theme.active && <Badge tone="info">Owned</Badge>}
                  <span className={cn("text-[12px]", theme.tier === "included" ? "text-ink-500" : "font-medium text-ink-800")}>{price(theme.priceCents)}</span>
                </div>
              </div>
              <p className="mt-0.5 text-[12.5px] text-ink-500">{theme.tagline}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-ink-400">{TIER_LABEL[theme.tier]} · {CATEGORY_LABEL[theme.category]}</p>
            </div>
          </button>
        ))}
        {list.length === 0 && <p className="col-span-full py-12 text-center text-[13px] text-ink-500">No themes match.</p>}
      </div>

      <ThemeDetail
        theme={selected}
        storeSlug={storeSlug}
        canWrite={canWrite}
        canBuy={canBuy}
        paymentsConfigured={paymentsConfigured}
        buying={buying}
        onClose={() => setSelected(null)}
        onApply={(t) => setConfirm(t)}
        onBuy={buy}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title={`Apply "${confirm?.name}" to your store?`}
        description="Your current design is saved as a snapshot first, so you can restore it from the editor's History at any time. The theme replaces your design tokens and recomposes the homepage from your own products and collections; your product data is untouched."
        confirmLabel="Apply theme"
        loading={applying}
        onConfirm={() => confirm && apply(confirm)}
      />
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={cn("rounded-full border px-2.5 py-1 text-[12px]", active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 text-ink-600 hover:border-ink-400")}>{children}</button>;
}

/** An original miniature built from the theme's own tokens — never a screenshot. */
function ThemeSwatch({ theme, large }: { theme: GalleryTheme; large?: boolean }) {
  const t = theme;
  const hero = t.heroLayout;
  const hd = { fontFamily: "var(--st-font-display)", fontWeight: "var(--st-heading-weight)" as React.CSSProperties["fontWeight"], textTransform: "var(--st-heading-transform)" as React.CSSProperties["textTransform"], letterSpacing: "var(--st-heading-spacing)" };
  return (
    <div className="st-root" data-card={t.cardStyle} style={{ ...(t.vars as React.CSSProperties), background: "var(--st-bg)", color: "var(--st-fg)", fontFamily: "var(--st-font-body)" }}>
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${t.fontFamilies.map((f) => `family=${f.family.replace(/ /g, "+")}:wght@${f.weights.join(";")}`).join("&")}&display=swap`} />
      <div className={cn("flex items-center px-3 text-[8px]", large ? "h-8" : "h-6", t.headerStyle === "centered" || t.headerStyle === "split" ? "justify-center" : "justify-between")} style={{ borderBottom: "1px solid var(--st-border)" }}>
        <span style={hd}>{t.name}</span>
        {t.headerStyle !== "centered" && t.headerStyle !== "split" && <span className="st-muted">Shop · About</span>}
      </div>
      {hero === "split" ? (
        <div className={cn("grid grid-cols-2 items-center gap-2 px-3", large ? "py-5" : "py-3")}>
          <div><div className={large ? "text-[15px]" : "text-[11px]"} style={{ ...hd, lineHeight: 1.05 }}>Everyday, elevated.</div><div className="mt-1.5 inline-block rounded px-2 py-0.5 text-[7px] font-semibold" style={{ background: "var(--st-btn-bg)", color: "var(--st-btn-fg)", borderRadius: "var(--st-radius-button)" }}>Shop now</div></div>
          <div className="st-radius-image" style={{ aspectRatio: "4/3", background: "linear-gradient(135deg, var(--st-surface-alt), color-mix(in srgb, var(--st-accent) 30%, var(--st-surface-alt)))" }} />
        </div>
      ) : hero === "fullBleed" || hero === "bottomLeft" || hero === "overlay" || hero === "editorial" && t.isDark ? (
        <div className={cn("flex flex-col justify-end px-3", large ? "h-24" : "h-16")} style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--st-accent) 35%, var(--st-contrast-bg)), var(--st-contrast-bg))", color: "var(--st-contrast-fg)", paddingBottom: 8 }}>
          <div className={large ? "text-[16px]" : "text-[12px]"} style={{ ...hd, lineHeight: 1 }}>Drop 01 is live.</div>
        </div>
      ) : hero === "center" ? (
        <div className={cn("px-3 text-center", large ? "py-5" : "py-3")} style={{ background: "var(--st-surface-alt)" }}><div className={large ? "text-[16px]" : "text-[12px]"} style={{ ...hd, lineHeight: 1.05 }}>Turn it up.</div><div className="mt-1.5 inline-block rounded px-2 py-0.5 text-[7px] font-semibold" style={{ background: "var(--st-btn-bg)", color: "var(--st-btn-fg)", borderRadius: "var(--st-radius-button)" }}>Shop now</div></div>
      ) : (
        <div className={cn("px-3", large ? "py-5" : "py-3")}><div className="st-eyebrow mb-1" style={{ fontSize: 6 }}>New season</div><div className={large ? "text-[15px]" : "text-[11px]"} style={{ ...hd, lineHeight: 1.05, maxWidth: "80%" }}>Made slowly, kept for years.</div></div>
      )}
      <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="st-product-card" style={{ fontSize: 7 }}>
            <div className="st-product-media" style={{ background: i === 1 ? "color-mix(in srgb, var(--st-accent) 25%, var(--st-surface-alt))" : "var(--st-surface-alt)" }} />
            <div className="st-product-body" style={{ marginTop: 3, padding: t.cardStyle === "framed" || t.cardStyle === "elevated" ? "3px 4px 4px" : undefined }}><div>Product</div><div className="st-muted">$48</div></div>
          </div>
        ))}
      </div>
      <div className="flex gap-1 px-3 pb-2">
        {t.swatch.map((c) => <span key={c} className="size-2.5 rounded-full border border-black/10" style={{ background: c }} />)}
      </div>
    </div>
  );
}

function ThemeDetail({ theme, storeSlug, canWrite, canBuy, paymentsConfigured, buying, onClose, onApply, onBuy }: {
  theme: GalleryTheme | null; storeSlug: string; canWrite: boolean; canBuy: boolean; paymentsConfigured: boolean; buying: boolean;
  onClose: () => void; onApply: (t: GalleryTheme) => void; onBuy: (t: GalleryTheme) => void;
}) {
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [previewing, setPreviewing] = React.useState(false);
  React.useEffect(() => { setPreviewing(false); setDevice("desktop"); }, [theme?.id]);
  if (!theme) return null;
  const premium = theme.tier !== "included";
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{theme.name} {theme.active && <Badge tone="success">Active</Badge>}{premium && theme.owned && <Badge tone="info">Owned</Badge>}</DialogTitle>
          <DialogDescription>{theme.tagline} · {TIER_LABEL[theme.tier]} · {price(theme.priceCents)}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {previewing ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12.5px] text-ink-500">Live preview with your own products and collections. Nothing is changed until you apply.</p>
                <div className="flex rounded-md border border-ink-200 p-0.5">
                  <button type="button" onClick={() => setDevice("desktop")} aria-pressed={device === "desktop"} aria-label="Desktop preview" className={cn("rounded px-2 py-1", device === "desktop" ? "bg-ink-900 text-white" : "text-ink-500")}><Monitor className="size-3.5" /></button>
                  <button type="button" onClick={() => setDevice("mobile")} aria-pressed={device === "mobile"} aria-label="Mobile preview" className={cn("rounded px-2 py-1", device === "mobile" ? "bg-ink-900 text-white" : "text-ink-500")}><Smartphone className="size-3.5" /></button>
                </div>
              </div>
              <div className="mx-auto overflow-hidden rounded-md border border-ink-300 bg-white" style={{ maxWidth: device === "mobile" ? 390 : "100%", height: "60vh" }}>
                <iframe src={`/preview-theme/${storeSlug}/${theme.id}`} title={`${theme.name} preview`} className="size-full" />
              </div>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
              <div className="overflow-hidden rounded-lg border border-ink-200"><ThemeSwatch theme={theme} large /></div>
              <div>
                <p className="text-[13.5px] leading-relaxed text-ink-700">{theme.description}</p>
                <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">What's in it</h3>
                <ul className="mt-1.5 space-y-1 text-[13px] text-ink-700">{theme.features.map((f) => <li key={f} className="flex items-start gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-pine-600" />{f}</li>)}</ul>
                <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Homepage composition</h3>
                <p className="mt-1 text-[12px] text-ink-500">{theme.sections.map((s) => s.replace(":", " · ")).join("  →  ")}</p>
                <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Type</h3>
                <p className="mt-1 text-[12px] text-ink-500">{theme.fontFamilies.map((f) => f.family).join(" + ")} · all fonts verified open-licence (see docs/fonts)</p>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setPreviewing((p) => !p)}>{previewing ? "Back to details" : "Preview with my store"}</Button>
          {premium && !theme.owned ? (
            canBuy ? (
              <Button size="sm" variant="primary" loading={buying} onClick={() => onBuy(theme)} disabled={!paymentsConfigured} title={paymentsConfigured ? undefined : "Payments are not connected on this deployment yet"}>
                <Sparkles />{paymentsConfigured ? `Buy for ${price(theme.priceCents)}` : "Purchases not connected yet"}
              </Button>
            ) : <span className="text-[12.5px] text-ink-500">Ask the owner to purchase this theme.</span>
          ) : canWrite ? (
            <Button size="sm" variant="primary" onClick={() => onApply(theme)} disabled={theme.active}>{theme.active ? "Currently active" : "Apply theme"}</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
