"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { PLANS, getPlan, type PlanId } from "@/lib/plans";
import { changePlanAction } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Usage = {
  aiThisMonth: number;
  aiAllTime: number;
  aiRemaining: number | null;
  teamMembers: number;
  products: number;
  runningExperiments: number;
};

function Meter({ label, used, cap }: { label: string; used: number; cap: number | null }) {
  const percent = cap === null ? 0 : Math.min(100, Math.round((used / Math.max(1, cap)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="text-ink-600">{label}</span>
        <span className="font-medium tabular-nums text-ink-900">
          {used.toLocaleString()}{cap !== null ? ` / ${cap.toLocaleString()}` : ""}
        </span>
      </div>
      {cap !== null && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div
            className={cn("h-full rounded-full", percent >= 90 ? "bg-[var(--color-signal-negative)]" : "bg-pine-600")}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function BillingSettings({
  planId,
  billingCycle,
  billingConnected,
  usage,
}: {
  planId: PlanId;
  planStatus: string;
  billingCycle: "MONTHLY" | "ANNUAL";
  cancelAtPeriodEnd: boolean;
  billingConnected: boolean;
  usage: Usage;
}) {
  const router = useRouter();
  const current = getPlan(planId);
  const [cycle, setCycle] = React.useState<"MONTHLY" | "ANNUAL">(billingCycle);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function choose(id: PlanId) {
    setBusy(id);
    const result = await changePlanAction(id, cycle);
    setBusy(null);
    if (result.ok) {
      toast.success(result.message ?? "Plan updated");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const aiCap =
    current.limits.aiStarterActions ?? current.limits.aiActionsPerMonth ?? null;
  const aiUsed =
    current.limits.aiStarterActions !== null ? usage.aiAllTime : usage.aiThisMonth;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[22px] font-semibold tracking-[-0.01em] text-ink-900">{current.name}</span>
            <Badge tone={current.monthly === 0 ? "neutral" : "solid"}>
              {current.monthly === 0
                ? "Free"
                : `$${cycle === "ANNUAL" ? current.annualMonthly : current.monthly}/mo${cycle === "ANNUAL" ? " billed annually" : ""}`}
            </Badge>
          </div>
          <p className="mt-1 text-[13px] text-ink-500">{current.tagline}</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Meter
              label={current.limits.aiStarterActions !== null ? "AI actions (one-time starter allowance)" : "AI actions this month"}
              used={aiUsed}
              cap={aiCap}
            />
            <Meter label="Team members" used={usage.teamMembers} cap={current.limits.teamMembers} />
            <Meter label="Products" used={usage.products} cap={current.limits.products} />
            <Meter label="A/B tests running" used={usage.runningExperiments} cap={current.limits.runningExperiments} />
          </div>
        </CardContent>
      </Card>

      {!billingConnected && (
        <div className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-[13px] text-ink-600">
          <span className="font-medium text-ink-900">Billing is not connected yet.</span> Plan changes
          apply immediately and nothing is charged. When Stripe billing is configured, paid plans will
          check out through Stripe and this page will show invoices and payment details.
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Change plan</CardTitle>
            <div className="inline-flex rounded-md border border-ink-200 bg-white p-0.5 text-[12.5px]">
              {(["MONTHLY", "ANNUAL"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCycle(option)}
                  className={cn(
                    "rounded px-2.5 py-1 font-medium",
                    cycle === option ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900",
                  )}
                >
                  {option === "ANNUAL" ? "Annual" : "Monthly"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const price = cycle === "ANNUAL" ? plan.annualMonthly : plan.monthly;
            const isCurrent = plan.id === current.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-md border p-4",
                  isCurrent ? "border-ink-900" : "border-ink-200",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-ink-900">{plan.name}</span>
                  {isCurrent && <Badge tone="neutral">Current</Badge>}
                </div>
                <p className="mt-2 text-[19px] font-semibold text-ink-900">
                  {price === 0 ? "Free" : `$${price}`}
                  {price > 0 && <span className="ml-1 text-[11.5px] font-normal text-ink-500">/mo</span>}
                </p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex gap-1.5 text-[12px] text-ink-600">
                      <Check className="mt-0.5 size-3 shrink-0 text-pine-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant={isCurrent ? "ghost" : "secondary"}
                  className="mt-3 w-full"
                  disabled={isCurrent || busy !== null}
                  loading={busy === plan.id}
                  onClick={() => choose(plan.id)}
                >
                  {isCurrent ? "Your plan" : plan.monthly > current.monthly ? "Upgrade" : "Switch"}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
