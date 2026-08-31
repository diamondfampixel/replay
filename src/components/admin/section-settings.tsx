"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageField } from "@/components/admin/media-picker";
import { SECTION_META, type SectionType } from "@/lib/storefront/sections";

type Config = Record<string, unknown>;

/**
 * Renders the editing form for a section's configuration. Each control writes
 * one key of the section's JSON config — exactly what the AI tools write too.
 */
export function SectionSettings({
  type,
  config,
  onChange,
  collections,
  products,
}: {
  type: SectionType;
  config: Config;
  onChange: (config: Config) => void;
  collections: Array<{ slug: string; title: string }>;
  products: Array<{ id: string; title: string }>;
}) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  const text = (key: string) => (typeof config[key] === "string" ? (config[key] as string) : "");
  const num = (key: string, fallback: number) =>
    typeof config[key] === "number" ? (config[key] as number) : fallback;

  return (
    <div className="space-y-3.5">
      <p className="text-[12px] text-ink-500">{SECTION_META[type].description}</p>

      {(type === "hero" || type === "imageHero") && (
        <>
          <Field label="Headline" htmlFor="headline">
            <Textarea id="headline" rows={2} value={text("headline")} onChange={(e) => set("headline", e.target.value)} />
          </Field>
          <Field label="Subheadline" htmlFor="subheadline">
            <Textarea id="subheadline" rows={2} value={text("subheadline")} onChange={(e) => set("subheadline", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Button label" htmlFor="ctaLabel">
              <Input id="ctaLabel" value={text("ctaLabel")} onChange={(e) => set("ctaLabel", e.target.value)} />
            </Field>
            <Field label="Button link" htmlFor="ctaHref">
              <Input id="ctaHref" value={text("ctaHref")} onChange={(e) => set("ctaHref", e.target.value)} placeholder="/shop" />
            </Field>
          </div>
          {type === "hero" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Second button" htmlFor="secondaryCtaLabel">
                <Input id="secondaryCtaLabel" value={text("secondaryCtaLabel")} onChange={(e) => set("secondaryCtaLabel", e.target.value)} />
              </Field>
              <Field label="Second link" htmlFor="secondaryCtaHref">
                <Input id="secondaryCtaHref" value={text("secondaryCtaHref")} onChange={(e) => set("secondaryCtaHref", e.target.value)} />
              </Field>
            </div>
          )}
          <Field label="Background image">
            <ImageField value={(config.imageUrl as string) ?? null} onChange={(url) => set("imageUrl", url)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Alignment" htmlFor="align">
              <Select id="align" value={text("align") || "left"} onChange={(e) => set("align", e.target.value)}>
                <option value="left">Left</option>
                <option value="center">Centred</option>
              </Select>
            </Field>
            {type === "hero" ? (
              <Field label="Height" htmlFor="height">
                <Select id="height" value={text("height") || "large"} onChange={(e) => set("height", e.target.value)}>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </Select>
              </Field>
            ) : (
              <Field label="Overlay strength" htmlFor="overlay">
                <Input
                  id="overlay" type="number" min="0" max="80"
                  value={num("overlay", 30)}
                  onChange={(e) => set("overlay", Number(e.target.value))}
                />
              </Field>
            )}
          </div>
        </>
      )}

      {type === "announcement" && (
        <>
          <Field label="Message" htmlFor="text">
            <Input id="text" value={text("text")} onChange={(e) => set("text", e.target.value)} />
          </Field>
          <Field label="Link" htmlFor="link">
            <Input id="link" value={text("link")} onChange={(e) => set("link", e.target.value)} placeholder="/shop" />
          </Field>
          <Field label="Background" htmlFor="announceBg">
            <Select id="announceBg" value={text("background") || "ink"} onChange={(e) => set("background", e.target.value)}>
              <option value="ink">Dark</option>
              <option value="brand">Brand colour</option>
              <option value="muted">Light</option>
            </Select>
          </Field>
        </>
      )}

      {(type === "featuredProducts" || type === "productGrid" || type === "collectionGrid" ||
        type === "reviews" || type === "faq" || type === "newsletter" || type === "benefits" ||
        type === "testimonials" || type === "text" || type === "imageText" || type === "customBanner") && (
        <Field label="Heading" htmlFor="heading">
          <Input id="heading" value={text("heading")} onChange={(e) => set("heading", e.target.value)} />
        </Field>
      )}

      {type === "featuredProducts" && (
        <>
          <Field label="Subheading" htmlFor="subheading">
            <Input id="subheading" value={text("subheading")} onChange={(e) => set("subheading", e.target.value)} />
          </Field>
          <Field label="Products come from" htmlFor="source">
            <Select id="source" value={text("source") || "newest"} onChange={(e) => set("source", e.target.value)}>
              <option value="newest">Newest products</option>
              <option value="bestsellers">Best sellers</option>
              <option value="collection">A collection</option>
              <option value="manual">Chosen by hand</option>
            </Select>
          </Field>
          {text("source") === "collection" && (
            <Field label="Collection" htmlFor="collectionSlug">
              <Select id="collectionSlug" value={text("collectionSlug")} onChange={(e) => set("collectionSlug", e.target.value)}>
                <option value="">Choose a collection…</option>
                {collections.map((collection) => (
                  <option key={collection.slug} value={collection.slug}>{collection.title}</option>
                ))}
              </Select>
            </Field>
          )}
          {text("source") === "manual" && (
            <div>
              <Label>Products</Label>
              <div className="scroll-thin max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-ink-200 p-2">
                {products.map((product) => {
                  const selected = ((config.productIds as string[]) ?? []).includes(product.id);
                  return (
                    <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[12.5px] hover:bg-ink-50">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--color-pine-600)]"
                        checked={selected}
                        onChange={(event) => {
                          const current = ((config.productIds as string[]) ?? []);
                          set(
                            "productIds",
                            event.target.checked
                              ? [...current, product.id]
                              : current.filter((id) => id !== product.id),
                          );
                        }}
                      />
                      <span className="truncate text-ink-700">{product.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <Field label="How many" htmlFor="limit">
            <Input id="limit" type="number" min="2" max="12" value={num("limit", 4)} onChange={(e) => set("limit", Number(e.target.value))} />
          </Field>
        </>
      )}

      {type === "collectionGrid" && (
        <div>
          <Label>Collections shown</Label>
          <div className="scroll-thin max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-ink-200 p-2">
            {collections.map((collection) => {
              const selected = ((config.collectionSlugs as string[]) ?? []).includes(collection.slug);
              return (
                <label key={collection.slug} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[12.5px] hover:bg-ink-50">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[var(--color-pine-600)]"
                    checked={selected}
                    onChange={(event) => {
                      const current = ((config.collectionSlugs as string[]) ?? []);
                      set(
                        "collectionSlugs",
                        event.target.checked
                          ? [...current, collection.slug]
                          : current.filter((slug) => slug !== collection.slug),
                      );
                    }}
                  />
                  <span className="truncate text-ink-700">{collection.title}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-[11.5px] text-ink-400">Leave all unchecked to show your first six collections.</p>
        </div>
      )}

      {type === "productGrid" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="How many" htmlFor="gridLimit">
            <Input id="gridLimit" type="number" min="3" max="48" value={num("limit", 12)} onChange={(e) => set("limit", Number(e.target.value))} />
          </Field>
          <Field label="Columns" htmlFor="columns">
            <Select id="columns" value={String(num("columns", 4))} onChange={(e) => set("columns", Number(e.target.value))}>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </Select>
          </Field>
        </div>
      )}

      {(type === "text" || type === "imageText" || type === "customBanner") && (
        <Field label="Body" htmlFor="body">
          <Textarea id="body" rows={5} value={text("body")} onChange={(e) => set("body", e.target.value)} />
        </Field>
      )}

      {type === "imageText" && (
        <>
          <Field label="Image">
            <ImageField value={(config.imageUrl as string) ?? null} onChange={(url) => set("imageUrl", url)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Image side" htmlFor="imagePosition">
              <Select id="imagePosition" value={text("imagePosition") || "right"} onChange={(e) => set("imagePosition", e.target.value)}>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </Select>
            </Field>
            <Field label="Button label" htmlFor="itCtaLabel">
              <Input id="itCtaLabel" value={text("ctaLabel")} onChange={(e) => set("ctaLabel", e.target.value)} />
            </Field>
          </div>
          <Field label="Button link" htmlFor="itCtaHref">
            <Input id="itCtaHref" value={text("ctaHref")} onChange={(e) => set("ctaHref", e.target.value)} />
          </Field>
        </>
      )}

      {type === "customBanner" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Button label" htmlFor="bannerCta">
            <Input id="bannerCta" value={text("ctaLabel")} onChange={(e) => set("ctaLabel", e.target.value)} />
          </Field>
          <Field label="Button link" htmlFor="bannerHref">
            <Input id="bannerHref" value={text("ctaHref")} onChange={(e) => set("ctaHref", e.target.value)} />
          </Field>
        </div>
      )}

      {type === "benefits" && (
        <RepeatableList
          label="Benefits"
          items={(config.items as Array<{ title: string; body: string }>) ?? []}
          onChange={(items) => set("items", items)}
          blank={{ title: "", body: "" }}
          fields={[
            { key: "title", label: "Title" },
            { key: "body", label: "Description", multiline: true },
          ]}
        />
      )}

      {type === "testimonials" && (
        <>
          <div className="rounded-md border border-ink-200 bg-ink-50 px-2.5 py-2 text-[11.5px] text-ink-600">
            Only add quotes real customers actually gave you. This section stays hidden on your live
            store while it is empty.
          </div>
          <RepeatableList
            label="Testimonials"
            items={(config.items as Array<{ quote: string; author: string; role: string }>) ?? []}
            onChange={(items) => set("items", items)}
            blank={{ quote: "", author: "", role: "" }}
            fields={[
              { key: "quote", label: "Quote", multiline: true },
              { key: "author", label: "Name" },
              { key: "role", label: "Role or location" },
            ]}
          />
        </>
      )}

      {type === "faq" && (
        <RepeatableList
          label="Questions"
          items={(config.items as Array<{ q: string; a: string }>) ?? []}
          onChange={(items) => set("items", items)}
          blank={{ q: "", a: "" }}
          fields={[
            { key: "q", label: "Question" },
            { key: "a", label: "Answer", multiline: true },
          ]}
        />
      )}

      {type === "reviews" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="How many" htmlFor="reviewLimit">
              <Input id="reviewLimit" type="number" min="1" max="12" value={num("limit", 3)} onChange={(e) => set("limit", Number(e.target.value))} />
            </Field>
            <Field label="Minimum rating" htmlFor="minRating">
              <Select id="minRating" value={String(num("minRating", 4))} onChange={(e) => set("minRating", Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>{rating} stars and up</option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="text-[11.5px] text-ink-400">
            Pulls real published reviews from your catalog. Nothing is invented.
          </p>
        </>
      )}

      {type === "newsletter" && (
        <>
          <Field label="Body" htmlFor="newsletterBody">
            <Textarea id="newsletterBody" rows={2} value={text("body")} onChange={(e) => set("body", e.target.value)} />
          </Field>
          <Field label="Button label" htmlFor="buttonLabel">
            <Input id="buttonLabel" value={text("buttonLabel")} onChange={(e) => set("buttonLabel", e.target.value)} />
          </Field>
        </>
      )}

      {type !== "announcement" && (
        <div className="grid grid-cols-2 gap-2 border-t border-ink-200 pt-3">
          <Field label="Background" htmlFor="background">
            <Select id="background" value={text("background") || "white"} onChange={(e) => set("background", e.target.value)}>
              <option value="white">White</option>
              <option value="muted">Light grey</option>
              <option value="brand">Brand colour</option>
              <option value="ink">Dark</option>
            </Select>
          </Field>
          <Field label="Spacing" htmlFor="spacing">
            <Select id="spacing" value={text("spacing") || "normal"} onChange={(e) => set("spacing", e.target.value)}>
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="roomy">Roomy</option>
            </Select>
          </Field>
        </div>
      )}
    </div>
  );
}

function RepeatableList<T extends Record<string, string>>({
  label, items, onChange, blank, fields,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  blank: T;
  fields: Array<{ key: keyof T & string; label: string; multiline?: boolean }>;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="mb-0">{label}</Label>
        <Button size="sm" variant="ghost" onClick={() => onChange([...items, { ...blank }])}>
          <Plus />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="rounded-md border border-dashed border-ink-300 px-3 py-3 text-center text-[12px] text-ink-400">
            Nothing yet.
          </p>
        )}
        {items.map((item, index) => (
          <div key={index} className="rounded-md border border-ink-200 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-[var(--color-signal-negative)]"
                aria-label={`Remove item ${index + 1}`}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((field) =>
                field.multiline ? (
                  <Textarea
                    key={field.key}
                    rows={2}
                    value={item[field.key] ?? ""}
                    placeholder={field.label}
                    aria-label={field.label}
                    onChange={(event) =>
                      onChange(items.map((entry, i) => (i === index ? { ...entry, [field.key]: event.target.value } : entry)))
                    }
                    className="text-[12.5px]"
                  />
                ) : (
                  <Input
                    key={field.key}
                    value={item[field.key] ?? ""}
                    placeholder={field.label}
                    aria-label={field.label}
                    onChange={(event) =>
                      onChange(items.map((entry, i) => (i === index ? { ...entry, [field.key]: event.target.value } : entry)))
                    }
                    className="h-8 text-[12.5px]"
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
