"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, annualSavings } from "@/lib/plans";
import { cn } from "@/lib/utils";

export function PlanCards() {
  const [cycle, setCycle] = React.useState<"monthly" | "annual">("annual");

  return (
    <div>
      <div className="mt-7 inline-flex rounded-md border border-night-line bg-night-900 p-0.5 text-[13px]">
        {(["monthly", "annual"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCycle(option)}
            className={cn(
              "rounded px-3 py-1.5 font-medium capitalize",
              cycle === option ? "bg-night-text text-night-950" : "text-night-muted hover:text-night-text",
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
                "flex flex-col rounded-lg border bg-night-900 p-5",
                plan.highlight
                  ? "border-glow-green/50 shadow-[0_2px_8px_rgba(16,16,14,0.08)]"
                  : "border-night-line",
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-night-text">{plan.name}</h2>
                {plan.highlight && (
                <span className="rounded-full bg-glow-green/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-glow-green">Popular</span>
              )}
              </div>
              <p className="mt-1 min-h-9 text-[12.5px] text-night-muted">{plan.tagline}</p>
              <p className="mt-4 text-[28px] font-semibold tracking-[-0.02em] text-night-text">
                {price === 0 ? "Free" : `$${price}`}
                {price > 0 && (
                  <span className="ml-1 text-[12.5px] font-normal text-night-muted">
                    /month{cycle === "annual" ? ", billed annually" : ""}
                  </span>
                )}
              </p>
              <p className="mt-1 min-h-4 text-[11.5px] text-night-muted">
                {plan.introFirstMonth !== null && cycle === "monthly"
                  ? `$${plan.introFirstMonth} for your first month`
                  : plan.monthly > 0 && cycle === "annual"
                    ? `$${annualSavings(plan)} less than paying monthly`
                    : " "}
              </p>
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-[13px] text-night-muted">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-glow-green" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={cn(
                  "mt-5 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-[13.5px] font-medium transition-colors",
                  plan.highlight
                    ? "bg-night-text text-night-950 hover:bg-white"
                    : "border border-night-line-strong text-night-text hover:border-night-faint",
                )}
              >
                {plan.monthly === 0 ? "Start free" : `Start with ${plan.name}`}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
