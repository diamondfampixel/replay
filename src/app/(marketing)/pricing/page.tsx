import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <h1 className="text-[32px] font-semibold tracking-[-0.02em] text-ink-900">Pricing</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-ink-600">
        Plans below are placeholders for a future billing integration. Billing is not connected in
        this build — nothing is charged, and every plan currently unlocks the full feature set.
      </p>

      <div className="mt-9 grid gap-4 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "flex flex-col rounded-lg border bg-white p-5",
              plan.highlight ? "border-ink-900 shadow-[0_2px_8px_rgba(16,16,14,0.08)]" : "border-ink-200",
            )}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink-900">{plan.name}</h2>
              {plan.highlight && <Badge tone="solid">Popular</Badge>}
            </div>
            <p className="mt-1 text-[12.5px] text-ink-500">{plan.tagline}</p>
            <p className="mt-4 text-[28px] font-semibold tracking-[-0.02em] text-ink-900">
              {plan.price === 0 ? "Free" : `$${plan.price}`}
              <span className="ml-1 text-[12.5px] font-normal text-ink-500">{plan.cadence}</span>
            </p>
            <ul className="mt-5 flex-1 space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-[13px] text-ink-700">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-pine-600" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant={plan.highlight ? "primary" : "secondary"}
              className="mt-5 w-full"
            >
              <Link href="/signup">{plan.price === 0 ? "Start free" : "Choose plan"}</Link>
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-[13px] text-ink-600">
        <span className="font-medium text-ink-900">Billing status:</span> not configured. Selecting a
        plan creates your account on the demo tier. Stripe billing can be added later without
        changing the plan model.
      </div>
    </main>
  );
}
