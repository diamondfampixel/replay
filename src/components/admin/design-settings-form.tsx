"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { updateDesignSettingsAction } from "@/app/actions/settings";
import {
  BUTTON_HOVERS, BUTTON_SHAPES, BUTTON_SIZES, BUTTON_STYLES, CARD_HOVERS, CARD_STYLES, COLLECTION_HEROES, DENSITIES, DESIGN_DIRECTIONS,
  DIRECTION_PRESETS, FONTS, FONT_KEYS, FOOTER_STYLES, GRID_GAPS, HEADER_STYLES, IMAGE_RATIOS, MOTION_LEVELS, NEUTRAL_TEMPS, PAGE_WIDTHS,
  PRODUCT_BLOCKS, PRODUCT_LAYOUTS, RADII, REVEAL_STYLES, SECTION_SPACINGS, SHADOWS, SOCIAL_KEYS, resolveTheme, themeWarnings,
  type DesignDirection, type StoreTheme,
} from "@/lib/storefront/theme";
import { DNA_AXES, DNA_MOVES, applyDnaMove, describeDna, type DesignDNA, type DnaAxis } from "@/lib/storefront/dna";
import { CUSTOM_CSS_MAX } from "@/lib/storefront/custom-css";
import { cn } from "@/lib/utils";

type Group = "colors" | "typography" | "layout" | "shape" | "surface" | "buttons" | "cards" | "headerConfig" | "footer" | "product" | "collection" | "motionConfig";

/**
 * The store's global design system. Direction + Design DNA set the character;
 * every group below fine-tunes it. The same structured theme the AI designer
 * writes — nothing here is CSS except the scoped escape hatch at the end.
 */
export function DesignSettingsForm({
  initial, primaryColor, secondaryColor, storeSlug, canWrite,
}: {
  initial: StoreTheme;
  primaryColor: string;
  secondaryColor: string;
  storeSlug: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [theme, setTheme] = React.useState<StoreTheme>(initial);
  const [pending, startTransition] = React.useTransition();
  const [dirty, setDirty] = React.useState(false);

  const resolved = React.useMemo(() => resolveTheme({ theme, primaryColor, secondaryColor }), [theme, primaryColor, secondaryColor]);
  const warnings = React.useMemo(() => themeWarnings(resolved), [resolved]);
  const preset = DIRECTION_PRESETS[theme.direction];

  function update(patch: Partial<StoreTheme>) { setTheme((prev) => ({ ...prev, ...patch })); setDirty(true); }
  function group<G extends Group>(key: G, patch: Partial<NonNullable<StoreTheme[G]>>) {
    setTheme((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), ...patch } }));
    setDirty(true);
  }
  function pickDirection(direction: DesignDirection) {
    // Switching direction starts fresh from its preset, keeping the accent + colours.
    setTheme({ direction, accent: theme.accent, colors: theme.colors, footer: theme.footer?.social ? { social: theme.footer.social } : undefined });
    setDirty(true);
  }
  function setDna(axis: DnaAxis, value: number) {
    const full: DesignDNA = { ...resolved.dna, [axis]: value };
    update({ dna: full });
  }
  function save() {
    startTransition(async () => {
      const result = await updateDesignSettingsAction(theme);
      if (!result.ok) { toast.error(result.error ?? "Could not save"); return; }
      toast.success("Design saved");
      setDirty(false);
      router.refresh();
    });
  }

  const disabled = !canWrite;
  const font = (key: string | undefined) => key ? `${FONTS[key as keyof typeof FONTS].family}` : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-[12.5px] text-amber-900">
            <p className="mb-1 flex items-center gap-1.5 font-medium"><AlertTriangle className="size-3.5" />Check these before saving</p>
            <ul className="list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        )}

        <Tabs defaultValue="dna">
          <TabsList className="flex-wrap">
            <TabsTrigger value="dna">Direction & DNA</TabsTrigger>
            <TabsTrigger value="colors">Colours</TabsTrigger>
            <TabsTrigger value="type">Typography</TabsTrigger>
            <TabsTrigger value="layout">Layout & shape</TabsTrigger>
            <TabsTrigger value="components">Buttons & cards</TabsTrigger>
            <TabsTrigger value="chrome">Header & footer</TabsTrigger>
            <TabsTrigger value="commerce">Product & collection</TabsTrigger>
            <TabsTrigger value="motion">Motion</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* ---------------------------------------------------------------- */}
          <TabsContent value="dna" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Design direction</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-4 text-[13px] text-ink-500">A direction is a starting point, not a template: it sets the DNA, a font pairing and a few opinions. Everything below stays editable.</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {DESIGN_DIRECTIONS.map((d) => {
                    const p = DIRECTION_PRESETS[d];
                    const active = theme.direction === d;
                    return (
                      <button key={d} type="button" disabled={disabled} onClick={() => pickDirection(d)} aria-pressed={active}
                        className={cn("rounded-lg border p-3 text-left transition-colors", active ? "border-ink-900 bg-ink-50" : "border-ink-200 hover:border-ink-400")}>
                        <span className="block text-[13.5px] font-semibold text-ink-900">{p.label}</span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-ink-500">{p.blurb}</span>
                        <span className="mt-1.5 block text-[11px] text-ink-400">{FONTS[p.fontDisplay].family} + {FONTS[p.fontBody].family}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Design DNA</CardTitle>
                {theme.dna && canWrite && (
                  <button type="button" onClick={() => update({ dna: undefined })} className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900"><RotateCcw className="size-3" />Reset to {preset.label}</button>
                )}
              </CardHeader>
              <CardContent>
                <p className="mb-1 text-[13px] text-ink-700">{describeDna(resolved.dna)}</p>
                <p className="mb-4 text-[12.5px] text-ink-500">Seven axes describe your brand&apos;s character. They set sensible defaults for every token, shape how new sections arrive, and guide the AI designer — so a store never looks &ldquo;suddenly generic&rdquo;.</p>
                <div className="space-y-3">
                  {DNA_AXES.map((axis) => (
                    <div key={axis.key}>
                      <div className="mb-1 flex items-center justify-between text-[12px]">
                        <span className="text-ink-500">{axis.low}</span>
                        <span className="font-medium text-ink-800 capitalize">{axis.key}</span>
                        <span className="text-ink-500">{axis.high}</span>
                      </div>
                      <input type="range" min={0} max={100} value={resolved.dna[axis.key]} disabled={disabled} onChange={(e) => setDna(axis.key, Number(e.target.value))} className="w-full accent-[var(--color-pine-600)]" aria-label={`${axis.low} to ${axis.high}`} />
                      <p className="text-[11px] text-ink-400">{axis.hint}</p>
                    </div>
                  ))}
                </div>
                <p className="mb-2 mt-5 text-[12.5px] font-medium text-ink-700">Nudge it</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(DNA_MOVES) as Array<keyof typeof DNA_MOVES>).map((id) => (
                    <button key={id} type="button" disabled={disabled} onClick={() => update({ dna: applyDnaMove(resolved.dna, id) })} className="rounded-full border border-ink-200 px-2.5 py-1 text-[12px] capitalize text-ink-700 hover:border-ink-400">
                      {id}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          <TabsContent value="colors" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Colour roles</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Choice label="Neutral base" options={NEUTRAL_TEMPS} value={theme.neutral ?? preset.neutral} onChange={(v) => update({ neutral: v })} disabled={disabled} labels={{ ink: "ink (dark)", midnight: "midnight (dark)" }} />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ColorField label="Accent" value={theme.accent ?? theme.colors?.primary ?? primaryColor} onChange={(v) => update({ accent: v })} disabled={disabled} />
                  <ColorField label="Secondary" value={theme.colors?.secondary} placeholder={secondaryColor} onChange={(v) => group("colors", { secondary: v })} disabled={disabled} />
                  <ColorField label="Background" value={theme.colors?.background} placeholder={resolved.vars["--st-bg"]} onChange={(v) => group("colors", { background: v })} disabled={disabled} />
                  <ColorField label="Text" value={theme.colors?.foreground} placeholder={resolved.vars["--st-fg"]} onChange={(v) => group("colors", { foreground: v })} disabled={disabled} />
                  <ColorField label="Button" value={theme.colors?.button} placeholder={resolved.vars["--st-btn-bg"]} onChange={(v) => group("colors", { button: v })} disabled={disabled} />
                  <ColorField label="Button text" value={theme.colors?.buttonText} placeholder={resolved.vars["--st-btn-fg"]} onChange={(v) => group("colors", { buttonText: v })} disabled={disabled} />
                  <ColorField label="Links" value={theme.colors?.link} placeholder={resolved.vars["--st-link"]} onChange={(v) => group("colors", { link: v })} disabled={disabled} />
                  <ColorField label="Sale price" value={theme.colors?.sale} placeholder={resolved.vars["--st-sale"]} onChange={(v) => group("colors", { sale: v })} disabled={disabled} />
                  <ColorField label="Borders" value={theme.colors?.border} placeholder={resolved.vars["--st-border"]} onChange={(v) => group("colors", { border: v })} disabled={disabled} />
                </div>
                <p className="text-[12px] text-ink-500">Roles you leave empty are derived from the neutral base and accent, with contrast checked automatically.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Custom section schemes</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[12.5px] text-ink-500">Up to three named background/text pairs any section can use from its Design tab.</p>
                {(theme.schemes ?? []).map((s, i) => (
                  <div key={i} className="grid items-end gap-2 rounded-md border border-ink-200 p-2.5 sm:grid-cols-[1fr_auto_auto_auto_auto]">
                    <Field label="Name" htmlFor={`scheme-${i}`}><Input id={`scheme-${i}`} value={s.name} disabled={disabled} onChange={(e) => update({ schemes: theme.schemes!.map((x, j) => (j === i ? { ...x, name: e.target.value, id: x.id } : x)) })} /></Field>
                    <ColorField label="Background" value={s.background} onChange={(v) => update({ schemes: theme.schemes!.map((x, j) => (j === i ? { ...x, background: v ?? x.background } : x)) })} disabled={disabled} />
                    <ColorField label="Text" value={s.foreground} onChange={(v) => update({ schemes: theme.schemes!.map((x, j) => (j === i ? { ...x, foreground: v ?? x.foreground } : x)) })} disabled={disabled} />
                    <ColorField label="Accent" value={s.accent} onChange={(v) => update({ schemes: theme.schemes!.map((x, j) => (j === i ? { ...x, accent: v } : x)) })} disabled={disabled} />
                    <Button size="sm" variant="ghost" disabled={disabled} onClick={() => update({ schemes: theme.schemes!.filter((_, j) => j !== i) })}>Remove</Button>
                  </div>
                ))}
                {(theme.schemes ?? []).length < 3 && (
                  <Button size="sm" variant="secondary" disabled={disabled} onClick={() => update({ schemes: [...(theme.schemes ?? []), { id: `scheme-${(theme.schemes?.length ?? 0) + 1}-${Date.now().toString(36).slice(-4)}`, name: `Scheme ${(theme.schemes?.length ?? 0) + 1}`, background: "#1f2937", foreground: "#ffffff" }] })}>Add scheme</Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          <TabsContent value="type" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Typography</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <FontSelect label="Headings" value={theme.typography?.display ?? theme.fontDisplay ?? preset.fontDisplay} onChange={(v) => group("typography", { display: v })} disabled={disabled} />
                  <FontSelect label="Body" value={theme.typography?.body ?? theme.fontBody ?? preset.fontBody} onChange={(v) => group("typography", { body: v })} disabled={disabled} />
                  <FontSelect label="Accent (eyebrows, numbers)" value={theme.typography?.accent ?? resolved.fontAccent} onChange={(v) => group("typography", { accent: v })} disabled={disabled} />
                </div>
                <Slider label="Heading size" value={theme.typography?.headingScale ?? Number(resolved.vars["--st-heading-scale"])} min={0.8} max={1.4} step={0.05} onChange={(v) => group("typography", { headingScale: v })} disabled={disabled} format={(v) => `${Math.round(v * 100)}%`} />
                <Slider label="Heading weight" value={theme.typography?.headingWeight ?? Number(resolved.vars["--st-heading-weight"])} min={400} max={900} step={100} onChange={(v) => group("typography", { headingWeight: v })} disabled={disabled} />
                <Slider label="Heading letter-spacing" value={theme.typography?.headingTracking ?? parseFloat(resolved.vars["--st-heading-spacing"])} min={-0.06} max={0.12} step={0.01} onChange={(v) => group("typography", { headingTracking: v })} disabled={disabled} format={(v) => `${v.toFixed(2)}em`} />
                <Choice label="Heading case" options={["none", "uppercase"] as const} value={theme.typography?.headingTransform ?? theme.headingTransform ?? preset.headingTransform} onChange={(v) => group("typography", { headingTransform: v })} disabled={disabled} labels={{ none: "As written", uppercase: "UPPERCASE" }} />
                <Slider label="Body size" value={theme.typography?.bodyScale ?? Number(resolved.vars["--st-body-scale"])} min={0.9} max={1.15} step={0.05} onChange={(v) => group("typography", { bodyScale: v })} disabled={disabled} format={(v) => `${Math.round(v * 100)}%`} />
                <Slider label="Body line height" value={theme.typography?.bodyLineHeight ?? Number(resolved.vars["--st-body-lh"])} min={1.3} max={1.9} step={0.05} onChange={(v) => group("typography", { bodyLineHeight: v })} disabled={disabled} />
                <Choice label="Eyebrow style" options={["mono", "caps", "plain"] as const} value={theme.typography?.eyebrowStyle ?? resolved.eyebrowStyle} onChange={(v) => group("typography", { eyebrowStyle: v })} disabled={disabled} labels={{ mono: "Mono / accent font", caps: "Small caps", plain: "Plain" }} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          <TabsContent value="layout" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Layout</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Choice label="Page width" options={PAGE_WIDTHS} value={theme.layout?.width ?? resolved.layout.width} onChange={(v) => group("layout", { width: v })} disabled={disabled} />
                <Choice label="Whitespace" options={DENSITIES} value={theme.layout?.density ?? resolved.layout.density} onChange={(v) => group("layout", { density: v })} disabled={disabled} />
                <Choice label="Section spacing" options={SECTION_SPACINGS} value={theme.layout?.sectionSpacing ?? resolved.layout.sectionSpacing} onChange={(v) => group("layout", { sectionSpacing: v })} disabled={disabled} />
                <Choice label="Grid gap" options={GRID_GAPS} value={theme.layout?.gridGap ?? resolved.layout.gridGap} onChange={(v) => group("layout", { gridGap: v })} disabled={disabled} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Shape & surface</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Choice label="Corner radius" options={RADII} value={theme.shape?.radius ?? theme.radius ?? preset.radius} onChange={(v) => group("shape", { radius: v })} disabled={disabled} />
                <Choice label="Image corners" options={RADII} value={theme.shape?.image ?? theme.shape?.radius ?? theme.radius ?? preset.radius} onChange={(v) => group("shape", { image: v })} disabled={disabled} />
                <Choice label="Inputs" options={["sharp", "rounded", "pill"] as const} value={theme.shape?.input ?? (resolved.vars["--st-radius-input"] === "9999px" ? "pill" : resolved.vars["--st-radius-input"] === "0px" ? "sharp" : "rounded")} onChange={(v) => group("shape", { input: v })} disabled={disabled} />
                <Choice label="Border width" options={[0, 1, 2] as const} value={theme.surface?.borderWidth ?? (Number(parseInt(resolved.vars["--st-border-w"])) as 0 | 1 | 2)} onChange={(v) => group("surface", { borderWidth: v })} disabled={disabled} labels={{ "0": "None", "1": "Hairline", "2": "Bold" }} />
                <Choice label="Shadow" options={SHADOWS} value={theme.surface?.shadow ?? (Object.entries({ none: "none" }).find(([, v]) => v === resolved.vars["--st-shadow"])?.[0] as never) ?? "soft"} onChange={(v) => group("surface", { shadow: v })} disabled={disabled} />
                <Toggle label="Glass effect on overlays" checked={theme.surface?.glass ?? false} onChange={(v) => group("surface", { glass: v })} disabled={disabled} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          <TabsContent value="components" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Buttons</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Choice label="Style" options={BUTTON_STYLES} value={theme.buttons?.style ?? resolved.buttons.style} onChange={(v) => group("buttons", { style: v })} disabled={disabled} />
                <Choice label="Shape" options={BUTTON_SHAPES} value={theme.buttons?.shape ?? resolved.buttons.shape} onChange={(v) => group("buttons", { shape: v })} disabled={disabled} />
                <Choice label="Size" options={BUTTON_SIZES} value={theme.buttons?.size ?? resolved.buttons.size} onChange={(v) => group("buttons", { size: v })} disabled={disabled} />
                <Choice label="Hover" options={BUTTON_HOVERS} value={theme.buttons?.hover ?? resolved.buttons.hover} onChange={(v) => group("buttons", { hover: v })} disabled={disabled} />
                <Toggle label="Uppercase labels" checked={theme.buttons?.uppercase ?? resolved.buttons.uppercase} onChange={(v) => group("buttons", { uppercase: v })} disabled={disabled} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Product cards</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Choice label="Style" options={CARD_STYLES} value={theme.cards?.style ?? resolved.cards.style} onChange={(v) => group("cards", { style: v })} disabled={disabled} />
                <Choice label="Image shape" options={IMAGE_RATIOS} value={theme.cards?.ratio ?? resolved.cards.ratio} onChange={(v) => group("cards", { ratio: v })} disabled={disabled} />
                <Choice label="Hover" options={CARD_HOVERS} value={theme.cards?.hover ?? resolved.cards.hover} onChange={(v) => group("cards", { hover: v })} disabled={disabled} labels={{ swap: "swap to 2nd image" }} />
                <Choice label="Text alignment" options={["left", "center"] as const} value={theme.cards?.align ?? resolved.cards.align} onChange={(v) => group("cards", { align: v })} disabled={disabled} />
                <Choice label="Price emphasis" options={["muted", "normal", "strong"] as const} value={theme.cards?.priceEmphasis ?? resolved.cards.priceEmphasis} onChange={(v) => group("cards", { priceEmphasis: v })} disabled={disabled} />
                <Toggle label="Show star ratings" checked={theme.cards?.showRating ?? resolved.cards.showRating} onChange={(v) => group("cards", { showRating: v })} disabled={disabled} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          <TabsContent value="chrome" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Header</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Choice label="Layout" options={HEADER_STYLES} value={theme.headerConfig?.style ?? theme.header ?? preset.header} onChange={(v) => group("headerConfig", { style: v })} disabled={disabled} labels={{ transparent: "transparent over hero" }} />
                <Choice label="Logo size" options={["sm", "md", "lg"] as const} value={theme.headerConfig?.logoSize ?? "md"} onChange={(v) => group("headerConfig", { logoSize: v })} disabled={disabled} />
                <Toggle label="Sticky on scroll" checked={theme.headerConfig?.sticky ?? true} onChange={(v) => group("headerConfig", { sticky: v })} disabled={disabled} />
                <Toggle label="Bottom border" checked={theme.headerConfig?.border ?? true} onChange={(v) => group("headerConfig", { border: v })} disabled={disabled} />
                <Toggle label="Uppercase navigation" checked={theme.headerConfig?.navUppercase ?? resolved.header.navUppercase} onChange={(v) => group("headerConfig", { navUppercase: v })} disabled={disabled} />
                <Toggle label="Show search" checked={theme.headerConfig?.showSearch ?? true} onChange={(v) => group("headerConfig", { showSearch: v })} disabled={disabled} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Footer</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Choice label="Layout" options={FOOTER_STYLES} value={theme.footer?.style ?? preset.footer} onChange={(v) => group("footer", { style: v })} disabled={disabled} />
                <Choice label="Background" options={["base", "muted", "contrast"] as const} value={theme.footer?.scheme ?? "muted"} onChange={(v) => group("footer", { scheme: v })} disabled={disabled} />
                <Field label="Brand statement" htmlFor="brandStatement" hint="Shown in the footer instead of the store description."><Textarea id="brandStatement" rows={2} disabled={disabled} value={theme.footer?.brandStatement ?? ""} onChange={(e) => group("footer", { brandStatement: e.target.value })} /></Field>
                <Toggle label="Newsletter signup in footer" checked={theme.footer?.showNewsletter ?? false} onChange={(v) => group("footer", { showNewsletter: v })} disabled={disabled} />
                <Toggle label="Show social icons" checked={theme.footer?.showSocial ?? true} onChange={(v) => group("footer", { showSocial: v })} disabled={disabled} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {SOCIAL_KEYS.map((key) => (
                    <Field key={key} label={key === "x" ? "X (Twitter)" : key.charAt(0).toUpperCase() + key.slice(1)} htmlFor={`social-${key}`}>
                      <Input id={`social-${key}`} placeholder="https://…" disabled={disabled} value={theme.footer?.social?.[key] ?? ""} onChange={(e) => group("footer", { social: { ...(theme.footer?.social ?? {}), [key]: e.target.value } })} />
                    </Field>
                  ))}
                </div>
                <p className="text-[12px] text-ink-500">An icon only appears once its link is filled in — the storefront never shows a dead social link.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          <TabsContent value="commerce" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Product page</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Choice label="Layout" options={PRODUCT_LAYOUTS} value={theme.product?.layout ?? resolved.product.layout} onChange={(v) => group("product", { layout: v })} disabled={disabled} labels={{ mediaLeft: "media left", stickyInfo: "sticky info" }} />
                <Choice label="Image shape" options={IMAGE_RATIOS} value={theme.product?.imageRatio ?? resolved.product.imageRatio} onChange={(v) => group("product", { imageRatio: v })} disabled={disabled} />
                <BlockOrder value={theme.product?.blocks ?? resolved.product.blocks} onChange={(v) => group("product", { blocks: v })} disabled={disabled} />
                <Toggle label="Show reviews" checked={theme.product?.showReviews ?? true} onChange={(v) => group("product", { showReviews: v })} disabled={disabled} />
                <Toggle label="Show “You may also like”" checked={theme.product?.showRecommended ?? true} onChange={(v) => group("product", { showRecommended: v })} disabled={disabled} />
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-ink-700">Trust items <span className="font-normal text-ink-400">(only what you really offer)</span></p>
                  <div className="space-y-1.5">
                    {(theme.product?.trustItems ?? []).map((item, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={item.text} disabled={disabled} onChange={(e) => group("product", { trustItems: theme.product!.trustItems!.map((x, j) => (j === i ? { text: e.target.value } : x)) })} />
                        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => group("product", { trustItems: theme.product!.trustItems!.filter((_, j) => j !== i) })}>Remove</Button>
                      </div>
                    ))}
                    {(theme.product?.trustItems ?? []).length < 4 && <Button size="sm" variant="secondary" disabled={disabled} onClick={() => group("product", { trustItems: [...(theme.product?.trustItems ?? []), { text: "" }] })}>Add item</Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Collections & shop</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Choice label="Columns" options={[2, 3, 4, 5] as const} value={theme.collection?.columns ?? resolved.collection.columns} onChange={(v) => group("collection", { columns: v })} disabled={disabled} />
                <Choice label="Mobile columns" options={[1, 2] as const} value={theme.collection?.mobileColumns ?? resolved.collection.mobileColumns} onChange={(v) => group("collection", { mobileColumns: v })} disabled={disabled} />
                <Choice label="Collection header" options={COLLECTION_HEROES} value={theme.collection?.hero ?? resolved.collection.hero} onChange={(v) => group("collection", { hero: v })} disabled={disabled} labels={{ none: "hidden", text: "title + text", banner: "image banner" }} />
                <Choice label="Image shape" options={IMAGE_RATIOS} value={theme.collection?.imageRatio ?? resolved.collection.imageRatio} onChange={(v) => group("collection", { imageRatio: v })} disabled={disabled} />
                <Toggle label="Filters sidebar on the shop page" checked={theme.collection?.showFilters ?? true} onChange={(v) => group("collection", { showFilters: v })} disabled={disabled} />
                <Toggle label="Show product count" checked={theme.collection?.showCount ?? true} onChange={(v) => group("collection", { showCount: v })} disabled={disabled} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          <TabsContent value="motion" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Motion</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Choice label="Level" options={MOTION_LEVELS} value={theme.motionConfig?.level ?? resolved.motion} onChange={(v) => group("motionConfig", { level: v })} disabled={disabled} />
                <p className="text-[12px] text-ink-500">Off disables every animation. Every level respects the visitor&apos;s reduced-motion setting, and sections can override this individually.</p>
                <Choice label="Scroll reveal" options={REVEAL_STYLES} value={theme.motionConfig?.reveal ?? resolved.motionConfig.reveal} onChange={(v) => group("motionConfig", { reveal: v })} disabled={disabled} />
                <Choice label="Marquee speed" options={["slow", "normal", "fast"] as const} value={theme.motionConfig?.marqueeSpeed ?? resolved.motionConfig.marqueeSpeed} onChange={(v) => group("motionConfig", { marqueeSpeed: v })} disabled={disabled} />
                <Toggle label="Stagger items as they appear" checked={theme.motionConfig?.stagger ?? resolved.motionConfig.stagger} onChange={(v) => group("motionConfig", { stagger: v })} disabled={disabled} />
                <Toggle label="Parallax on image heroes" checked={theme.motionConfig?.parallax ?? resolved.motionConfig.parallax} onChange={(v) => group("motionConfig", { parallax: v })} disabled={disabled} />
                <Toggle label="Zoom images on hover" checked={theme.motionConfig?.imageZoom ?? resolved.motionConfig.imageZoom} onChange={(v) => group("motionConfig", { imageZoom: v })} disabled={disabled} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          <TabsContent value="advanced" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle>Custom CSS</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[12.5px] text-ink-500">An escape hatch for the last 5%. Rules are scoped to your storefront, sanitised (no imports, external URLs or scripts) and limited to {CUSTOM_CSS_MAX.toLocaleString()} characters. Use the <code className="rounded bg-ink-100 px-1">--st-*</code> tokens where you can.</p>
                <Textarea rows={10} disabled={disabled} className="font-mono text-[12px]" value={theme.customCss ?? ""} onChange={(e) => update({ customCss: e.target.value })} placeholder={".st-btn { letter-spacing: 0.1em; }\n.st-section[data-section-type=\"hero\"] h1 { font-style: italic; }"} />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11.5px] text-ink-400">{(theme.customCss ?? "").length.toLocaleString()} / {CUSTOM_CSS_MAX.toLocaleString()}</p>
                  {(theme.customCss ?? "").length > 0 && canWrite && (
                    <Button size="sm" variant="ghost" onClick={() => update({ customCss: "" })}><RotateCcw />Reset custom CSS</Button>
                  )}
                </div>
                <p className="text-[12px] text-ink-500">Available on every plan, including Free. Reset clears it; saving with an empty box removes it from the live store.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {canWrite && (
          <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-lg border border-ink-200 bg-white/95 p-3 shadow-sm backdrop-blur">
            <Button onClick={save} disabled={pending || !dirty}>{pending ? "Saving…" : dirty ? "Save design" : "Saved"}</Button>
            <Button asChild variant="secondary">
              <Link href={`/s/${storeSlug}`} target="_blank" rel="noreferrer">Preview store</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/admin/store/editor">Open editor</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Live preview built from the resolved theme tokens. */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="st-root overflow-hidden rounded-lg border border-ink-200" data-card={resolved.cardStyle} data-btn-hover={resolved.buttons.hover} style={resolved.vars as React.CSSProperties}>
              <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${resolved.fontFamilies.map((f) => `family=${f.family.replace(/ /g, "+")}:wght@${f.weights.join(";")}`).join("&")}&display=swap`} />
              <div className="flex items-center justify-between border-b px-4 py-2.5 text-[11px]" style={{ borderColor: "var(--st-border)" }}>
                <span className="st-display text-[13px]" style={{ fontWeight: "var(--st-heading-weight)" as React.CSSProperties["fontWeight"], textTransform: "var(--st-heading-transform)" as React.CSSProperties["textTransform"] }}>Your store</span>
                <span className="st-muted">Shop · About</span>
              </div>
              <div className="p-5">
                <p className="st-eyebrow">New season</p>
                <div className="st-h-md st-display st-heading-transform mt-1">Everyday, elevated.</div>
                <p className="st-muted st-body mt-2 text-[13px]">This preview uses your real theme tokens — the fonts render on the live store.</p>
                <div className="mt-4 flex gap-2">
                  <span className="st-btn st-btn-sm">Shop now</span>
                  <span className="st-btn st-btn-sm st-btn-secondary">Learn more</span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="st-product-card">
                      <div className="st-product-media" style={{ background: "var(--st-surface-alt)" }} />
                      <div className="st-product-body"><div className="text-[11px] font-medium">Product {i + 1}</div><div className="st-muted text-[11px]">$48</div></div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded p-3 text-[11px]" style={{ background: "var(--st-brand-bg)", color: "var(--st-brand-fg)" }}>Accent band · AA-checked text</div>
                <div className="mt-2 rounded p-3 text-[11px]" style={{ background: "var(--st-contrast-bg)", color: "var(--st-contrast-fg)" }}>Contrast band</div>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-ink-500">
              <dt>Direction</dt><dd className="text-ink-800">{preset.label}</dd>
              <dt>Headings</dt><dd className="text-ink-800">{font(resolved.fontDisplay)}</dd>
              <dt>Body</dt><dd className="text-ink-800">{font(resolved.fontBody)}</dd>
              <dt>Motion</dt><dd className="text-ink-800 capitalize">{resolved.motion}</dd>
              <dt>Product layout</dt><dd className="text-ink-800">{resolved.product.layout}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Choice<T extends string | number>({ label, options, value, onChange, disabled, labels }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; disabled?: boolean; labels?: Record<string, string> }) {
  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-medium text-ink-700">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((option) => (
          <button key={String(option)} type="button" disabled={disabled} onClick={() => onChange(option)} aria-pressed={value === option}
            className={cn("rounded-md border px-2.5 py-1 text-[12px] transition-colors", value === option ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 text-ink-600 hover:border-ink-400")}>
            {labels?.[String(option)] ?? String(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 text-[12.5px] text-ink-700">
      <span>{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange, disabled, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean; format?: (v: number) => string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12.5px]"><span className="font-medium text-ink-700">{label}</span><span className="tabular text-ink-500">{format ? format(value) : value}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-pine-600)]" aria-label={label} />
    </div>
  );
}

function ColorField({ label, value, placeholder, onChange, disabled }: { label: string; value?: string; placeholder?: string; onChange: (v: string | undefined) => void; disabled?: boolean }) {
  const id = React.useId();
  const current = value ?? placeholder ?? "#000000";
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-ink-700">{label}</label>
      <div className="flex items-center gap-2">
        <input id={id} type="color" disabled={disabled} value={current} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-ink-200 bg-white" />
        <span className="tabular text-[12px] text-ink-600">{current}</span>
        {value && !disabled && <button type="button" onClick={() => onChange(undefined)} className="text-[11px] text-ink-400 hover:text-ink-800">auto</button>}
      </div>
    </div>
  );
}

function FontSelect({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: (typeof FONT_KEYS)[number]) => void; disabled?: boolean }) {
  const id = React.useId();
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as (typeof FONT_KEYS)[number])}>
        {FONT_KEYS.map((key) => <option key={key} value={key}>{FONTS[key].family} · {FONTS[key].category}</option>)}
      </Select>
    </Field>
  );
}

const BLOCK_LABEL: Record<(typeof PRODUCT_BLOCKS)[number], string> = { vendor: "Brand / vendor", title: "Title", rating: "Rating", price: "Price", variants: "Variant picker", quantityBuy: "Quantity + add to cart", inventory: "Low-stock note", trust: "Trust items", description: "Description", details: "Details accordion", tags: "Tags", share: "Share" };

function BlockOrder({ value, onChange, disabled }: { value: readonly (typeof PRODUCT_BLOCKS)[number][]; onChange: (v: (typeof PRODUCT_BLOCKS)[number][]) => void; disabled?: boolean }) {
  const active = [...value];
  const inactive = PRODUCT_BLOCKS.filter((b) => !active.includes(b));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= active.length) return; const next = [...active]; [next[i], next[j]] = [next[j], next[i]]; onChange(next); };
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-medium text-ink-700">Information blocks <span className="font-normal text-ink-400">(reorder; add-to-cart is always available)</span></p>
      <ul className="divide-y divide-ink-200 rounded-md border border-ink-200">
        {active.map((b, i) => (
          <li key={b} className="flex items-center gap-2 px-2.5 py-1.5 text-[12.5px]">
            <span className="flex-1">{BLOCK_LABEL[b]}</span>
            <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} className="rounded px-1.5 text-ink-400 hover:text-ink-900 disabled:opacity-30" aria-label={`Move ${BLOCK_LABEL[b]} up`}>↑</button>
            <button type="button" disabled={disabled || i === active.length - 1} onClick={() => move(i, 1)} className="rounded px-1.5 text-ink-400 hover:text-ink-900 disabled:opacity-30" aria-label={`Move ${BLOCK_LABEL[b]} down`}>↓</button>
            <button type="button" disabled={disabled || b === "quantityBuy"} onClick={() => onChange(active.filter((x) => x !== b))} className="rounded px-1.5 text-ink-400 hover:text-[var(--color-signal-negative)] disabled:opacity-30" aria-label={`Hide ${BLOCK_LABEL[b]}`}>×</button>
          </li>
        ))}
      </ul>
      {inactive.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {inactive.map((b) => <button key={b} type="button" disabled={disabled} onClick={() => onChange([...active, b])} className="rounded-full border border-dashed border-ink-300 px-2.5 py-0.5 text-[11.5px] text-ink-500 hover:border-ink-500">+ {BLOCK_LABEL[b]}</button>)}
        </div>
      )}
    </div>
  );
}
