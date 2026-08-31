"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { TEST_TYPES, GOALS } from "@/lib/experiment-meta";
import { createExperimentAction } from "@/app/actions/experiments";
import { cn } from "@/lib/utils";

export type TargetOption = { id: string; label: string; sectionId?: string | null; sublabel?: string };

type VariantDraft = { name: string; isControl: boolean; weight: number; value: string };

export function ExperimentForm({
  pages,
  products,
  sections,
  aiConfigured,
}: {
  pages: TargetOption[];
  products: TargetOption[];
  sections: Array<{ pageId: string; id: string; type: string; label: string; currentValue: string }>;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [generating, setGenerating] = React.useState(false);

  const [name, setName] = React.useState("");
  const [hypothesis, setHypothesis] = React.useState("");
  const [testType, setTestType] = React.useState<string>("headline");
  const [goal, setGoal] = React.useState("purchase");
  const [pageId, setPageId] = React.useState(pages[0]?.id ?? "");
  const [productId, setProductId] = React.useState(products[0]?.id ?? "");
  const [sectionId, setSectionId] = React.useState("");
  const [variants, setVariants] = React.useState<VariantDraft[]>([
    { name: "A", isControl: true, weight: 50, value: "" },
    { name: "B", isControl: false, weight: 50, value: "" },
  ]);

  const meta = TEST_TYPES.find((type) => type.value === testType) ?? TEST_TYPES[0];
  const targetType = meta.target as "page" | "product";
  const field = meta.field;

  const pageSections = React.useMemo(
    () => sections.filter((section) => section.pageId === pageId),
    [sections, pageId],
  );

  // Seed the control with whatever is live today so the test is honest.
  React.useEffect(() => {
    if (targetType !== "page") return;
    const section = pageSections.find((s) => s.id === sectionId) ?? pageSections[0];
    if (!section) return;
    if (!sectionId) setSectionId(section.id);
    setVariants((prev) =>
      prev.map((variant, index) => (index === 0 && !variant.value ? { ...variant, value: section.currentValue } : variant)),
    );
  }, [pageSections, sectionId, targetType]);

  React.useEffect(() => {
    if (targetType !== "product") return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setVariants((prev) =>
      prev.map((variant, index) => (index === 0 && !variant.value ? { ...variant, value: product.label } : variant)),
    );
  }, [productId, products, targetType]);

  function rebalance(next: VariantDraft[]) {
    const share = Math.floor(100 / next.length);
    const balanced = next.map((variant, index) => ({
      ...variant,
      weight: index === next.length - 1 ? 100 - share * (next.length - 1) : share,
    }));
    setVariants(balanced);
  }

  async function generateVariants() {
    setGenerating(true);
    try {
      const response = await fetch("/api/ai/generate-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testType,
          field,
          control: variants[0]?.value ?? "",
          targetType,
          pageId: targetType === "page" ? pageId : null,
          productId: targetType === "product" ? productId : null,
          count: Math.max(1, variants.length - 1),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Generation failed");

      setVariants((prev) =>
        prev.map((variant, index) =>
          index === 0 ? variant : { ...variant, value: data.variants[index - 1] ?? variant.value },
        ),
      );
      toast.success("Variants generated — edit them before starting the test.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate variants");
    } finally {
      setGenerating(false);
    }
  }

  function submit() {
    startTransition(async () => {
      const result = await createExperimentAction({
        name,
        hypothesis: hypothesis || null,
        testType,
        targetType,
        pageId: targetType === "page" ? pageId : null,
        productId: targetType === "product" ? productId : null,
        sectionId: targetType === "page" ? sectionId || null : null,
        goal,
        variants: variants.map((variant) => ({
          name: variant.name,
          isControl: variant.isControl,
          weight: variant.weight,
          changes: { [field]: variant.value },
        })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Created");
      router.push(`/admin/experiments/${result.data.id}`);
    });
  }

  const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0);
  const valid =
    name.trim().length > 0 &&
    totalWeight === 100 &&
    variants.every((variant) => variant.value.trim().length > 0) &&
    (targetType === "page" ? Boolean(pageId) : Boolean(productId));

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader
        breadcrumb={
          <Link href="/admin/experiments" className="inline-flex items-center gap-1 hover:text-ink-800">
            <ArrowLeft className="size-3" />
            A/B Testing
          </Link>
        }
        title="New experiment"
        description="Create the test as a draft. Nothing is shown to visitors until you start it."
        actions={
          <Button variant="primary" size="sm" onClick={submit} loading={pending} disabled={!valid}>
            Create draft
          </Button>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <Field label="Experiment name" required htmlFor="name">
              <Input
                id="name" value={name} autoFocus
                onChange={(event) => setName(event.target.value)}
                placeholder="Homepage hero headline"
              />
            </Field>
            <Field label="Hypothesis" htmlFor="hypothesis" hint="What do you expect to happen, and why?">
              <Textarea
                id="hypothesis" rows={2} value={hypothesis}
                onChange={(event) => setHypothesis(event.target.value)}
                placeholder="Leading with the shipping offer will convert better than the brand statement."
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>What are you testing?</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Test type" htmlFor="testType">
              <Select id="testType" value={testType} onChange={(event) => setTestType(event.target.value)}>
                {TEST_TYPES.filter((type) => type.value !== "page").map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Goal" htmlFor="goal" hint="Which event counts as a conversion.">
              <Select id="goal" value={goal} onChange={(event) => setGoal(event.target.value)}>
                {GOALS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>

            {targetType === "page" ? (
              <>
                <Field label="Page" htmlFor="pageId">
                  <Select id="pageId" value={pageId} onChange={(event) => setPageId(event.target.value)}>
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>{page.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Section" htmlFor="sectionId" hint="The section whose copy is swapped.">
                  <Select id="sectionId" value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                    {pageSections.length === 0 && <option value="">No sections on this page</option>}
                    {pageSections.map((section) => (
                      <option key={section.id} value={section.id}>{section.label}</option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : (
              <Field label="Product" htmlFor="productId" className="sm:col-span-2">
                <Select id="productId" value={productId} onChange={(event) => setProductId(event.target.value)}>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.label}</option>
                  ))}
                </Select>
              </Field>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Variants</CardTitle>
              <p className="mt-0.5 text-[12.5px] text-ink-500">
                Variant A is the control — it should match what is live today.
              </p>
            </div>
            <div className="flex gap-2">
              {aiConfigured && (
                <Button size="sm" variant="secondary" onClick={generateVariants} loading={generating}
                  disabled={!variants[0]?.value.trim()}>
                  <Sparkles className="text-pine-600" />
                  Generate with AI
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={variants.length >= 6}
                onClick={() =>
                  rebalance([
                    ...variants,
                    {
                      name: String.fromCharCode(65 + variants.length),
                      isControl: false,
                      weight: 0,
                      value: "",
                    },
                  ])
                }
              >
                <Plus />
                Add variant
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {variants.map((variant, index) => (
              <div key={index} className="rounded-md border border-ink-200 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={variant.isControl ? "solid" : "outline"}>
                    Variant {variant.name}
                    {variant.isControl && " · control"}
                  </Badge>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Label className="mb-0 text-[12px]" htmlFor={`weight-${index}`}>Traffic</Label>
                    <Input
                      id={`weight-${index}`}
                      type="number" min="0" max="100"
                      value={variant.weight}
                      onChange={(event) =>
                        setVariants((prev) =>
                          prev.map((v, i) => (i === index ? { ...v, weight: Number(event.target.value) || 0 } : v)),
                        )
                      }
                      className="h-7 w-16 text-right text-[12.5px]"
                    />
                    <span className="text-[12px] text-ink-500">%</span>
                    {variants.length > 2 && !variant.isControl && (
                      <button
                        type="button"
                        onClick={() => rebalance(variants.filter((_, i) => i !== index))}
                        className="ml-1 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-[var(--color-signal-negative)]"
                        aria-label={`Remove variant ${variant.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <Textarea
                  rows={field === "description" ? 4 : 2}
                  value={variant.value}
                  onChange={(event) =>
                    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, value: event.target.value } : v)))
                  }
                  placeholder={variant.isControl ? "The copy that is live today" : "Your alternative"}
                />
              </div>
            ))}

            <p className={cn("text-[12.5px]", totalWeight === 100 ? "text-ink-500" : "text-[var(--color-signal-negative)]")}>
              Traffic allocation totals {totalWeight}%{totalWeight !== 100 && " — it must total 100%"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
