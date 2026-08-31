import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, Plus } from "lucide-react";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { listExperiments } from "@/lib/services/experiments";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, Dot } from "@/components/ui/badge";
import { DemoTag, EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";
import { EXPERIMENT_TONE } from "@/lib/status";
import { formatNumber } from "@/lib/money";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "A/B Testing" };
export const dynamic = "force-dynamic";

export default async function ExperimentsPage() {
  const auth = await requireCapability("experiments:read");
  const ctx = await serviceContext();
  const experiments = await listExperiments(ctx);
  const canWrite = can(auth.role, "experiments:write");

  const running = experiments.filter((e) => e.status === "RUNNING");
  const others = experiments.filter((e) => e.status !== "RUNNING");

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="A/B Testing"
        description="Test storefront variations against a control. Results below come from recorded impressions and conversions — a winner is only called when the data supports it."
        actions={
          canWrite && (
            <Button asChild size="sm" variant="primary">
              <Link href="/admin/experiments/new">
                <Plus />
                Create experiment
              </Link>
            </Button>
          )
        }
      />

      {experiments.length === 0 ? (
        <Card>
          <EmptyState
            icon={FlaskConical}
            title="No experiments yet"
            description="Test a headline, a product title, a call to action or a whole landing page section. Visitors are bucketed deterministically, so the same person always sees the same variant."
            action={canWrite ? { label: "Create your first test", href: "/admin/experiments/new" } : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {running.length > 0 && (
            <section>
              <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                Running
              </h2>
              <div className="space-y-3">
                {running.map((experiment) => (
                  <ExperimentCard key={experiment.id} experiment={experiment} />
                ))}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section>
              <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                Drafts and completed
              </h2>
              <div className="space-y-3">
                {others.map((experiment) => (
                  <ExperimentCard key={experiment.id} experiment={experiment} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

type ExperimentSummary = Awaited<ReturnType<typeof listExperiments>>[number];

function ExperimentCard({ experiment }: { experiment: ExperimentSummary }) {
  const { results } = experiment;
  const leaderName = results.leader?.name;

  return (
    <Card>
      <CardContent className="p-0">
        <Link href={`/admin/experiments/${experiment.id}`} className="block px-4 py-3.5 hover:bg-ink-50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[14.5px] font-semibold text-ink-900">{experiment.name}</h3>
                <Badge tone={EXPERIMENT_TONE[experiment.status]}>
                  {experiment.status === "RUNNING" && <Dot tone="success" />}
                  {experiment.status.toLowerCase()}
                </Badge>
                <Badge tone="outline">{experiment.testType.replace(/_/g, " ")}</Badge>
                {experiment.isDemo && <DemoTag label="Demo" />}
              </div>
              {experiment.hypothesis && (
                <p className="mt-1 max-w-2xl text-[12.5px] text-ink-500">{experiment.hypothesis}</p>
              )}
              <p className="mt-1 text-[11.5px] text-ink-400">
                Goal: {experiment.goal.replace(/_/g, " ")} ·{" "}
                {experiment.startedAt ? `started ${relativeTime(experiment.startedAt)}` : "not started"} ·{" "}
                {formatNumber(results.totalVisitors)} visitors
              </p>
            </div>

            {results.totalVisitors > 0 && (
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-ink-400">Leading</p>
                <p className="tabular text-[15px] font-semibold text-ink-900">
                  Variant {leaderName} · {results.leader?.conversionRate.toFixed(2)}%
                </p>
                <p
                  className={cn(
                    "text-[11.5px]",
                    results.significant ? "text-[var(--color-signal-positive)]" : "text-ink-400",
                  )}
                >
                  {results.significant ? "Statistically significant" : "Not yet conclusive"}
                </p>
              </div>
            )}
          </div>

          {results.variants.length > 0 && results.totalVisitors > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {results.variants.map((variant) => (
                <div
                  key={variant.id}
                  className={cn(
                    "rounded-md border px-2.5 py-2",
                    variant.id === results.leader?.id ? "border-pine-300 bg-pine-50/50" : "border-ink-200",
                  )}
                >
                  <p className="flex items-center gap-1.5 text-[11.5px] text-ink-500">
                    Variant {variant.name}
                    {variant.isControl && <span className="text-ink-400">(control)</span>}
                  </p>
                  <p className="tabular mt-0.5 text-[15px] font-semibold text-ink-900">
                    {variant.conversionRate.toFixed(2)}%
                  </p>
                  <p className="tabular text-[11px] text-ink-400">
                    {formatNumber(variant.conversions)} / {formatNumber(variant.visitors)}
                    {variant.upliftVsControl !== null && (
                      <span className={variant.upliftVsControl > 0 ? " text-[var(--color-signal-positive)]" : " text-[var(--color-signal-negative)]"}>
                        {" "}{variant.upliftVsControl > 0 ? "+" : ""}{variant.upliftVsControl.toFixed(1)}%
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Link>
      </CardContent>
    </Card>
  );
}
