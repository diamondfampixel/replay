"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Info, Pause, Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Dot } from "@/components/ui/badge";
import { DemoTag } from "@/components/ui/states";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/admin/confirm";
import { formatMoney, formatNumber } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { EXPERIMENT_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ExperimentResults } from "@/lib/services/experiments";
import type { ExperimentStatus } from "@/generated/prisma/client";
import {
  chooseWinnerAction, deleteExperimentAction, setExperimentStatusAction,
} from "@/app/actions/experiments";

export function ExperimentDetail({
  experiment, results, currency, canWrite,
}: {
  experiment: {
    id: string;
    name: string;
    status: ExperimentStatus;
    testType: string;
    goal: string;
    startedAt: string | null;
    endedAt: string | null;
    winnerVariantId: string | null;
    isDemo: boolean;
    targetLabel: string;
    targetHref: string | null;
  };
  results: ExperimentResults;
  currency: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [winnerCandidate, setWinnerCandidate] = React.useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      toast.success(result.message ?? "Done");
      setWinnerCandidate(null);
      setConfirmDelete(false);
      router.refresh();
    });
  }

  const winner = results.variants.find((variant) => variant.id === experiment.winnerVariantId);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={EXPERIMENT_TONE[experiment.status]}>
          {experiment.status === "RUNNING" && <Dot tone="success" />}
          {experiment.status.toLowerCase()}
        </Badge>
        <Badge tone="outline">{experiment.testType.replace(/_/g, " ")}</Badge>
        <Badge tone="outline">Goal: {experiment.goal.replace(/_/g, " ")}</Badge>
        {experiment.isDemo && <DemoTag label="Demo experiment" />}

        <div className="ml-auto flex flex-wrap gap-2">
          {experiment.targetHref && (
            <Button asChild size="sm" variant="secondary">
              <a href={experiment.targetHref} target="_blank" rel="noreferrer">
                <ExternalLink />
                View {experiment.targetLabel}
              </a>
            </Button>
          )}
          {canWrite && experiment.status === "DRAFT" && (
            <Button size="sm" variant="primary" loading={pending}
              onClick={() => run(() => setExperimentStatusAction(experiment.id, "RUNNING"))}>
              <Play />
              Start test
            </Button>
          )}
          {canWrite && experiment.status === "RUNNING" && (
            <>
              <Button size="sm" variant="secondary" loading={pending}
                onClick={() => run(() => setExperimentStatusAction(experiment.id, "PAUSED"))}>
                <Pause />
                Pause
              </Button>
              <Button size="sm" variant="secondary" loading={pending}
                onClick={() => run(() => setExperimentStatusAction(experiment.id, "COMPLETED"))}>
                <Square />
                Stop
              </Button>
            </>
          )}
          {canWrite && experiment.status === "PAUSED" && (
            <Button size="sm" variant="primary" loading={pending}
              onClick={() => run(() => setExperimentStatusAction(experiment.id, "RUNNING"))}>
              <Play />
              Resume
            </Button>
          )}
          {canWrite && (
            <Button size="sm" variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "mb-4 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-[13px]",
          results.significant
            ? "border-pine-200 bg-pine-50 text-pine-800"
            : "border-ink-200 bg-white text-ink-600",
        )}
      >
        <Info className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">
            {results.significant
              ? `Variant ${results.leader?.name} is ahead with statistical significance.`
              : "No winner can be called yet."}
          </p>
          <p className="mt-0.5">{results.readiness}</p>
        </div>
      </div>

      {winner && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-pine-200 bg-pine-50 px-4 py-3 text-[13px] text-pine-800">
          <CheckCircle2 className="size-4" />
          Variant {winner.name} was declared the winner
          {experiment.endedAt && ` on ${formatDate(experiment.endedAt)}`}.
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total visitors" value={formatNumber(results.totalVisitors)} />
        <Stat label="Total conversions" value={formatNumber(results.totalConversions)} />
        <Stat
          label="Overall rate"
          value={results.totalVisitors ? `${((results.totalConversions / results.totalVisitors) * 100).toFixed(2)}%` : "—"}
        />
        <Stat
          label="Running since"
          value={experiment.startedAt ? formatDate(experiment.startedAt) : "Not started"}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Results by variant</CardTitle>
          <span className="text-[12.5px] text-ink-500">
            Minimum {results.minimumVisitorsPerVariant} visitors per arm before a call
          </span>
        </CardHeader>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Variant</TH>
                <TH>Content</TH>
                <TH align="right">Traffic</TH>
                <TH align="right">Visitors</TH>
                <TH align="right">Conversions</TH>
                <TH align="right">Rate</TH>
                <TH align="right">Uplift</TH>
                <TH align="right">Revenue / visitor</TH>
                <TH align="right">p-value</TH>
                {canWrite && <TH />}
              </tr>
            </THead>
            <TBody>
              {results.variants.map((variant) => {
                const content = Object.values(variant.changes)[0];
                const isLeader = variant.id === results.leader?.id;
                return (
                  <TR key={variant.id} className={cn(isLeader && "bg-pine-50/40")}>
                    <TD>
                      <span className="flex items-center gap-1.5 font-medium text-ink-900">
                        {variant.name}
                        {variant.isControl && <Badge tone="outline">control</Badge>}
                        {variant.id === experiment.winnerVariantId && <Badge tone="success">winner</Badge>}
                      </span>
                    </TD>
                    <TD className="max-w-72">
                      <span className="line-clamp-2 text-ink-600">
                        {typeof content === "string" ? content : JSON.stringify(content)}
                      </span>
                    </TD>
                    <TD align="right" className="tabular text-ink-500">{variant.weight}%</TD>
                    <TD align="right" className="tabular">{formatNumber(variant.visitors)}</TD>
                    <TD align="right" className="tabular">{formatNumber(variant.conversions)}</TD>
                    <TD align="right" className="tabular font-medium text-ink-900">
                      {variant.conversionRate.toFixed(2)}%
                    </TD>
                    <TD align="right" className="tabular">
                      {variant.upliftVsControl === null ? (
                        <span className="text-ink-400">—</span>
                      ) : (
                        <span className={variant.upliftVsControl > 0
                          ? "text-[var(--color-signal-positive)]"
                          : "text-[var(--color-signal-negative)]"}>
                          {variant.upliftVsControl > 0 ? "+" : ""}{variant.upliftVsControl.toFixed(1)}%
                        </span>
                      )}
                    </TD>
                    <TD align="right" className="tabular">{formatMoney(variant.revenuePerVisitor, currency)}</TD>
                    <TD align="right" className="tabular text-ink-500">
                      {variant.pValue === null ? "—" : variant.pValue.toFixed(3)}
                    </TD>
                    {canWrite && (
                      <TD align="right">
                        {experiment.status !== "DRAFT" && !experiment.winnerVariantId && (
                          <Button size="sm" variant="secondary" onClick={() => setWinnerCandidate(variant.id)}>
                            Choose winner
                          </Button>
                        )}
                      </TD>
                    )}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
        <CardContent className="border-t border-ink-200 text-[12px] text-ink-400">
          Significance is a two-proportion z-test against the control. A p-value below 0.05 with at
          least {results.minimumVisitorsPerVariant} visitors and 10 conversions per arm is treated as
          conclusive; anything else is reported as inconclusive rather than dressed up as a result.
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(winnerCandidate)}
        onOpenChange={(open) => !open && setWinnerCandidate(null)}
        title="Declare this variant the winner?"
        description={
          results.significant
            ? "This stops the experiment and writes the winning copy onto your live store."
            : "The data is not yet conclusive. You can still declare a winner, but the difference may be noise. This stops the experiment and writes the winning copy onto your live store."
        }
        confirmLabel="Declare winner and apply"
        loading={pending}
        onConfirm={() => winnerCandidate && run(() => chooseWinnerAction(experiment.id, winnerCandidate, true))}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${experiment.name}?`}
        description="This permanently removes the experiment and all of its recorded impressions and conversions."
        confirmLabel="Delete experiment"
        destructive
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteExperimentAction(experiment.id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Experiment deleted");
            router.push("/admin/experiments");
          })
        }
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
      <p className="text-[12px] text-ink-500">{label}</p>
      <p className="tabular mt-0.5 text-[19px] font-semibold text-ink-900">{value}</p>
    </div>
  );
}
