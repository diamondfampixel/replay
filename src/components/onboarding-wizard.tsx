"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BRAND_PERSONALITIES, FEEL_CHOICES, HOMEPAGE_SECTION_CHOICES, INDUSTRIES,
  type OnboardingInput,
} from "@/lib/validation/onboarding";
import { DESIGN_DIRECTIONS, DIRECTION_PRESETS, FONTS } from "@/lib/storefront/theme";
import { completeOnboardingAction } from "@/app/actions/onboarding";

const STEPS = ["Business", "Audience", "Brand", "Homepage", "Finish"] as const;

const PALETTES = [
  { name: "Pine", primary: "#0E7C66", secondary: "#1A1A17" },
  { name: "Ink", primary: "#1A1A17", secondary: "#57574F" },
  { name: "Clay", primary: "#A1523A", secondary: "#2A2A25" },
  { name: "Harbour", primary: "#2B5F9E", secondary: "#12232F" },
  { name: "Olive", primary: "#4B6B2A", secondary: "#23281B" },
  { name: "Plum", primary: "#6E3E72", secondary: "#241A26" },
];

export function OnboardingWizard({ aiConfigured }: { aiConfigured: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<OnboardingInput>({
    businessName: "",
    industry: "",
    description: "",
    sells: "",
    targetCustomer: "",
    brandPersonality: "",
    aesthetic: "editorial",
    direction: "modern",
    feel: [],
    primaryColor: "#0E7C66",
    secondaryColor: "#1A1A17",
    contactEmail: "",
    sections: ["hero", "featuredProducts", "benefits", "reviews", "newsletter"],
    seedDemoProducts: false,
    generateWithAI: aiConfigured,
  });

  function set<K extends keyof OnboardingInput>(key: K, value: OnboardingInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(overrides: Partial<OnboardingInput> = {}) {
    const payload = { ...form, ...overrides };
    setErrors({});
    startTransition(async () => {
      const result = await completeOnboardingAction(payload);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        // Jump back to the step holding the first invalid field.
        const firstField = Object.keys(result.fieldErrors ?? {})[0];
        if (firstField && ["businessName", "industry", "description"].includes(firstField)) setStep(0);
        return;
      }
      toast.success(
        result.data.generatedBy === "demo"
          ? "Demo store created"
          : result.data.generatedBy === "ai"
            ? "Storefront generated"
            : "Storefront created",
      );
      router.replace("/admin");
      router.refresh();
    });
  }

  function canAdvance() {
    if (step === 0) {
      return form.businessName.trim().length > 0 && form.industry && form.description.trim().length >= 10;
    }
    return true;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink-900">
          Let&apos;s set up your business
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-500">
          A few questions, then Halyard builds a storefront you can edit by hand or by asking the
          assistant.
        </p>
      </div>

      <ol className="mb-6 flex items-center gap-1.5" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-1.5">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                index < step
                  ? "bg-pine-600 text-white"
                  : index === step
                    ? "bg-ink-900 text-white"
                    : "border border-ink-200 bg-white text-ink-400",
              )}
            >
              {index < step ? <Check className="size-3" /> : index + 1}
            </div>
            <span className={cn("hidden text-[12px] sm:block", index === step ? "font-medium text-ink-900" : "text-ink-400")}>
              {label}
            </span>
            {index < STEPS.length - 1 && <div className="h-px flex-1 bg-ink-200" />}
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="p-5 sm:p-6">
          {step === 0 && (
            <div className="space-y-4">
              <Field label="Business name" required error={errors.businessName} htmlFor="businessName">
                <Input
                  id="businessName"
                  value={form.businessName}
                  onChange={(event) => set("businessName", event.target.value)}
                  placeholder="Northwind Supply Co."
                  autoFocus
                />
              </Field>
              <Field label="Industry" required error={errors.industry} htmlFor="industry">
                <Select
                  id="industry"
                  value={form.industry}
                  onChange={(event) => set("industry", event.target.value)}
                >
                  <option value="">Choose an industry…</option>
                  {INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>{industry}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label="What does the business sell?"
                error={errors.sells}
                htmlFor="sells"
                hint="A sentence is plenty — this shapes the copy on your homepage."
              >
                <Input
                  id="sells"
                  value={form.sells}
                  onChange={(event) => set("sells", event.target.value)}
                  placeholder="Fleece, canvas bags, stoneware and lighting"
                />
              </Field>
              <Field
                label="Short business description"
                required
                error={errors.description}
                htmlFor="description"
                hint={`${form.description.length}/600 characters`}
              >
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(event) => set("description", event.target.value.slice(0, 600))}
                  placeholder="We make a small range of everyday essentials and make each one properly."
                  rows={3}
                />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <Field
                label="Who is the target customer?"
                htmlFor="targetCustomer"
                hint="The assistant uses this when writing copy, campaigns and product descriptions."
              >
                <Textarea
                  id="targetCustomer"
                  value={form.targetCustomer}
                  onChange={(event) => set("targetCustomer", event.target.value)}
                  placeholder="Design-minded people who buy fewer, better things and keep them for years."
                  rows={3}
                />
              </Field>
              <Field label="Brand personality" htmlFor="brandPersonality">
                <div className="flex flex-wrap gap-1.5">
                  {BRAND_PERSONALITIES.map((personality) => (
                    <button
                      key={personality}
                      type="button"
                      onClick={() => set("brandPersonality", personality)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                        form.brandPersonality === personality
                          ? "border-ink-900 bg-ink-900 text-white"
                          : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
                      )}
                    >
                      {personality}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Contact email" htmlFor="contactEmail" error={errors.contactEmail}>
                <Input
                  id="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => set("contactEmail", event.target.value)}
                  placeholder="hello@yourbrand.com"
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-[13px] font-medium text-ink-700">What should your brand feel like?</p>
                <p className="mb-2 text-[12px] text-ink-500">Pick a design direction. It sets your store&apos;s Design DNA — typography, shape, spacing, motion — and you can change every part of it later.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DESIGN_DIRECTIONS.map((direction) => {
                    const preset = DIRECTION_PRESETS[direction];
                    return (
                      <button
                        key={direction}
                        type="button"
                        onClick={() => set("direction", direction)}
                        aria-pressed={form.direction === direction}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors",
                          form.direction === direction ? "border-ink-900 bg-ink-50" : "border-ink-200 bg-white hover:bg-ink-50",
                        )}
                      >
                        <p className="text-[13px] font-medium text-ink-900">{preset.label}</p>
                        <p className="mt-0.5 text-[12px] text-ink-500">{preset.blurb}</p>
                        <p className="mt-1 text-[11px] text-ink-400">{FONTS[preset.fontDisplay].family} + {FONTS[preset.fontBody].family}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1 text-[13px] font-medium text-ink-700">Nudge the character <span className="font-normal text-ink-400">(up to three)</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {FEEL_CHOICES.map((feel) => {
                    const active = form.feel.includes(feel.id);
                    return (
                      <button
                        key={feel.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => set("feel", active ? form.feel.filter((f) => f !== feel.id) : form.feel.length >= 3 ? form.feel : [...form.feel, feel.id])}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                          active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
                        )}
                      >
                        {feel.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[13px] font-medium text-ink-700">Brand colours</p>
                <div className="flex flex-wrap gap-2">
                  {PALETTES.map((palette) => (
                    <button
                      key={palette.name}
                      type="button"
                      onClick={() => {
                        set("primaryColor", palette.primary);
                        set("secondaryColor", palette.secondary);
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2.5 py-2 text-[12.5px] transition-colors",
                        form.primaryColor === palette.primary
                          ? "border-ink-900"
                          : "border-ink-200 hover:bg-ink-50",
                      )}
                    >
                      <span className="flex">
                        <span className="size-4 rounded-l" style={{ background: palette.primary }} />
                        <span className="size-4 rounded-r" style={{ background: palette.secondary }} />
                      </span>
                      {palette.name}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Primary" htmlFor="primaryColor" error={errors.primaryColor}>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.primaryColor}
                        onChange={(event) => set("primaryColor", event.target.value)}
                        className="h-9 w-10 cursor-pointer rounded border border-ink-200 bg-white p-0.5"
                        aria-label="Primary colour picker"
                      />
                      <Input
                        id="primaryColor"
                        value={form.primaryColor}
                        onChange={(event) => set("primaryColor", event.target.value)}
                      />
                    </div>
                  </Field>
                  <Field label="Secondary" htmlFor="secondaryColor" error={errors.secondaryColor}>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.secondaryColor}
                        onChange={(event) => set("secondaryColor", event.target.value)}
                        className="h-9 w-10 cursor-pointer rounded border border-ink-200 bg-white p-0.5"
                        aria-label="Secondary colour picker"
                      />
                      <Input
                        id="secondaryColor"
                        value={form.secondaryColor}
                        onChange={(event) => set("secondaryColor", event.target.value)}
                      />
                    </div>
                  </Field>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-[13px] text-ink-600">
                Pick the sections you want on the homepage. You can add, remove and reorder them
                later in the visual editor, or just ask the assistant.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {HOMEPAGE_SECTION_CHOICES.map((section) => {
                  const checked = section.always || form.sections.includes(section.id);
                  return (
                    <label
                      key={section.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-[13px] transition-colors",
                        checked ? "border-ink-900 bg-ink-50" : "border-ink-200 bg-white hover:bg-ink-50",
                        section.always && "cursor-default opacity-70",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--color-pine-600)]"
                        checked={checked}
                        disabled={section.always}
                        onChange={(event) =>
                          set(
                            "sections",
                            event.target.checked
                              ? [...form.sections, section.id]
                              : form.sections.filter((id) => id !== section.id),
                          )
                        }
                      />
                      <span className="text-ink-800">{section.label}</span>
                      {section.always && <Badge tone="outline" className="ml-auto">Always</Badge>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
                <p className="text-[13px] font-medium text-ink-900">{form.businessName || "Your store"}</p>
                <p className="mt-1 text-[12.5px] text-ink-600">{form.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {form.industry && <Badge tone="outline">{form.industry}</Badge>}
                  {form.brandPersonality && <Badge tone="outline">{form.brandPersonality}</Badge>}
                  <Badge tone="outline">{form.sections.length + 1} sections</Badge>
                </div>
              </div>

              <label
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3.5 transition-colors",
                  aiConfigured ? "cursor-pointer border-ink-200 hover:bg-ink-50" : "border-ink-200 bg-ink-50 opacity-70",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 accent-[var(--color-pine-600)]"
                  checked={form.generateWithAI && aiConfigured}
                  disabled={!aiConfigured}
                  onChange={(event) => set("generateWithAI", event.target.checked)}
                />
                <div>
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-900">
                    <Sparkles className="size-3.5 text-pine-600" />
                    Write the homepage copy with AI
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-ink-500">
                    {aiConfigured
                      ? "The assistant writes headlines and section copy for your business. You can edit everything afterwards."
                      : "No Anthropic API key is configured, so a starter layout with editable placeholder copy will be used instead. Add a key in Integrations to enable this."}
                  </p>
                </div>
              </label>

              <div className="rounded-lg border border-ink-200 p-3.5">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-900">
                  <Store className="size-3.5 text-ink-400" />
                  Not ready to add products?
                </p>
                <p className="mt-0.5 text-[12.5px] text-ink-500">
                  Start with a fully populated demo business — 27 products, orders, customers,
                  analytics history and live experiments. Every demo record is flagged so you can
                  remove it later.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2.5"
                  loading={pending}
                  onClick={() => submit({ seedDemoProducts: true })}
                >
                  Explore with a demo store
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
        >
          <ArrowLeft />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            variant="primary"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance() || pending}
          >
            Continue
            <ArrowRight />
          </Button>
        ) : (
          <Button variant="brand" onClick={() => submit()} loading={pending}>
            {pending ? (
              <>Generating store…</>
            ) : (
              <>
                <Sparkles />
                Generate store
              </>
            )}
          </Button>
        )}
      </div>

      {pending && (
        <p className="mt-3 flex items-center justify-center gap-2 text-[12.5px] text-ink-500">
          <Loader2 className="size-3.5 animate-spin" />
          Setting up your organization, storefront and pages…
        </p>
      )}
    </div>
  );
}
