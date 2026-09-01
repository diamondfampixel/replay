"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, annualSavings } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PlanCards() {
  const [cycle, setCycle] = React.useState<"monthly" | "annual">("annual");

  return (
    <div>
      <div className="mt-7 inline-flex rounded-md border border-ink-200 bg-white p-0.5 text-[13px]">
        {(["monthly", "annual"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCycle(option)}
            className={cn(
              "rounded px-3 py-1.5 font-medium capitalize",
              cycle === option ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900",
            )}
          >
            {option === "annual" ? "Annual · save up to 23%" : "Monthly"}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const price = cycle === "annual" ? plan.annualMonthly : plan.monthly;
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-lg border bg-white p-5",
                plan.highlight
                  ? "border-ink-900 shadow-[0_2px_8px_rgba(16,16,14,0.08)]"
                  : "border-ink-200",
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-ink-900">{plan.name}</h2>
                {plan.highlight && <Badge tone="solid">Most popular</Badge>}
              </div>
              <p className="mt-1 min-h-9 text-[12.5px] text-ink-500">{plan.tagline}</p>
              <p className="mt-4 text-[28px] font-semibold tracking-[-0.02em] text-ink-900">
                {price === 0 ? "Free" : `$${price}`}
                {price > 0 && (
                  <span className="ml-1 text-[12.5px] font-normal text-ink-500">
                    /month{cycle === "annual" ? ", billed annually" : ""}
                  </span>
                )}
              </p>
              <p className="mt-1 min-h-4 text-[11.5px] text-ink-500">
                {plan.introFirstMonth !== null && cycle === "monthly"
                  ? `$${plan.introFirstMonth} for your first month`
                  : plan.monthly > 0 && cycle === "annual"
                    ? `$${annualSavings(plan)} less than paying monthly`
                    : " "}
              </p>
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-[13px] text-ink-700">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-pine-600" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button asChild variant={plan.highlight ? "primary" : "secondary"} className="mt-5 w-full">
                <Link href="/signup">{plan.monthly === 0 ? "Start free" : `Start with ${plan.name}`}</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
