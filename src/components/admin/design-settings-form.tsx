"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateDesignSettingsAction } from "@/app/actions/settings";
import {
  DESIGN_DIRECTIONS, DIRECTION_PRESETS, NEUTRAL_TEMPS, RADII, DENSITIES,
  BUTTON_SHAPES, resolveTheme, type StoreTheme, type DesignDirection,
} from "@/lib/storefront/theme";
import { cn } from "@/lib/utils";

/**
 * Merchant-facing control for the storefront design system. The same theme the
 * AI designer writes; here the operator picks a direction and a few tokens and
 * sees a live preview swatch built from the resolved theme.
 */
export function DesignSettingsForm({
  initial, primaryColor, storeSlug, canWrite,
}: {
  initial: StoreTheme;
  primaryColor: string;
  storeSlug: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [theme, setTheme] = React.useState<StoreTheme>(initial);
  const [pending, startTransition] = React.useTransition();

  const resolved = React.useMemo(
    () => resolveTheme({ theme, primaryColor }),
    [theme, primaryColor],
  );

  function pickDirection(direction: DesignDirection) {
    // Switching direction starts fresh from its preset, keeping the accent.
    setTheme({ direction, accent: theme.accent });
  }
  function set<K extends keyof StoreTheme>(key: K, value: StoreTheme[K]) {
    setTheme((prev) => ({ ...prev, [key]: value }));
  }
  function save() {
    startTransition(async () => {
      const result = await updateDesignSettingsAction(theme);
      if (!result.ok) {
        toast.error(result.error ?? "Could not save");
        return;
      }
      toast.success("Design saved");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Design direction</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-[13px] text-ink-500">
              A direction sets typography, shape, spacing, colour and motion together.
              Pick one, then fine-tune below — or ask the AI assistant to design it for you.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {DESIGN_DIRECTIONS.map((d) => {
                const preset = DIRECTION_PRESETS[d];
                const active = theme.direction === d;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!canWrite}
                    onClick={() => pickDirection(d)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      active ? "border-ink-900 bg-ink-50" : "border-ink-200 hover:border-ink-400",
                    )}
                    aria-pressed={active}
                  >
                    <span className="block text-[13.5px] font-semibold text-ink-900">{preset.label}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-ink-500">{preset.blurb}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fine-tune</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <TokenRow label="Corners" options={RADII} value={theme.radius ?? DIRECTION_PRESETS[theme.direction].radius}
              onChange={(v) => set("radius", v)} disabled={!canWrite} />
            <TokenRow label="Buttons" options={BUTTON_SHAPES} value={theme.buttonShape ?? DIRECTION_PRESETS[theme.direction].buttonShape}
              onChange={(v) => set("buttonShape", v)} disabled={!canWrite} />
            <TokenRow label="Whitespace" options={DENSITIES} value={theme.density ?? DIRECTION_PRESETS[theme.direction].density}
              onChange={(v) => set("density", v)} disabled={!canWrite} />
            <TokenRow label="Background" options={NEUTRAL_TEMPS} value={theme.neutral ?? DIRECTION_PRESETS[theme.direction].neutral}
              onChange={(v) => set("neutral", v)} disabled={!canWrite} />
            <div>
              <label className="mb-1.5 block text-[12.5px] font-medium text-ink-700" htmlFor="accent">Accent colour</label>
              <div className="flex items-center gap-2">
                <input
                  id="accent" type="color" disabled={!canWrite}
                  value={theme.accent ?? primaryColor}
                  onChange={(e) => set("accent", e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-ink-200 bg-white"
                />
                <span className="text-[13px] tabular text-ink-600">{theme.accent ?? primaryColor}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {canWrite && (
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save design"}</Button>
            <Button asChild variant="secondary">
              <Link href={`/s/${storeSlug}`} target="_blank" rel="noreferrer">Preview store</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Live preview swatch, built from the resolved theme tokens. */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-ink-200" style={resolved.vars as React.CSSProperties}>
              <div style={{ background: "var(--st-bg)", color: "var(--st-fg)" }} className="p-5">
                <div style={{ fontFamily: "var(--st-font-display)", fontWeight: "var(--st-heading-weight)" as React.CSSProperties["fontWeight"], letterSpacing: "var(--st-heading-spacing)", textTransform: "var(--st-heading-transform)" as React.CSSProperties["textTransform"] }} className="text-[22px] leading-tight">
                  Everyday, elevated.
                </div>
                <p className="mt-2 text-[13px]" style={{ color: "var(--st-muted-fg)", fontFamily: "var(--st-font-body)" }}>
                  This preview uses your real theme tokens — the fonts render on the live store.
                </p>
                <div className="mt-4 flex gap-2">
                  <span className="inline-flex h-9 items-center px-4 text-[13px] font-semibold" style={{ background: "var(--st-btn-bg)", color: "var(--st-btn-fg)", border: "1px solid var(--st-btn-border)", borderRadius: "var(--st-radius-button)" }}>
                    Shop now
                  </span>
                  <span className="inline-flex h-9 items-center px-4 text-[13px] font-semibold" style={{ color: "var(--st-fg)", border: "1px solid var(--st-border-strong)", borderRadius: "var(--st-radius-button)" }}>
                    Learn more
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i}>
                      <div className="st-product-media" style={{ background: "var(--st-surface-alt)", borderRadius: "var(--st-radius)", aspectRatio: "var(--st-image-ratio)" }} />
                      <div className="mt-1.5 text-[11px]" style={{ color: "var(--st-fg)", fontFamily: "var(--st-font-body)" }}>Product {i + 1}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-ink-500">
              Current: <span className="font-medium text-ink-700">{DIRECTION_PRESETS[theme.direction].label}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TokenRow<T extends string>({
  label, options, value, onChange, disabled,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-medium text-ink-700">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[12px] capitalize transition-colors",
              value === option ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 text-ink-600 hover:border-ink-400",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
