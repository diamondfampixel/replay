import type { Metadata } from "next";
import { PLANS } from "@/lib/plans";
import { PlanCards } from "@/components/marketing/plan-cards";

export const metadata: Metadata = { title: "Pricing" };

const rows: Array<{ label: string; value: (p: (typeof PLANS)[number]) => string }> = [
  { label: "Live checkout", value: (p) => (p.limits.liveCheckout ? "Yes" : "Test mode") },
  { label: "Products", value: (p) => (p.limits.products === null ? "Unlimited" : String(p.limits.products)) },
  { label: "Stores", value: (p) => String(p.limits.stores) },
  { label: "Team members", value: (p) => (p.limits.teamMembers === null ? "Unlimited" : String(p.limits.teamMembers)) },
  {
    label: "AI actions",
    value: (p) =>
      p.limits.aiActionsPerDay !== null
        ? `${p.limits.aiActionsPerDay} / day`
        : `${p.limits.aiActionsPerMonth!.toLocaleString()} / month`,
  },
  { label: "A/B tests running", value: (p) => (p.limits.runningExperiments === null ? "Unlimited" : String(p.limits.runningExperiments)) },
  { label: "Email campaigns", value: (p) => (p.limits.emailCampaigns ? "Yes" : "—") },
  { label: "Analytics history", value: (p) => (p.limits.analyticsHistoryDays === null ? "Everything" : `${p.limits.analyticsHistoryDays} days`) },
  { label: "Analytics export", value: (p) => (p.limits.analyticsExport ? "Yes" : "—") },
  { label: "Platform transaction fee", value: () => "0%" },
];

const faq = [
  {
    q: "What counts as an AI action?",
    a: "One task you give the assistant — a question answered, a product created, a price change proposed. A big multi-step job may count as a few. Reading your own dashboards never costs actions.",
  },
  {
    q: "Do you take a cut of my sales?",
    a: "No. Payments go through your own payment provider at their standard rates. Halyard adds 0% on every plan.",
  },
  {
    q: "What happens if I hit my AI limit?",
    a: "The assistant pauses until your allowance resets (midnight UTC on Harbor, monthly on paid plans) or you upgrade. Nothing else stops working — your store, checkout and analytics run as normal.",
  },
  {
    q: "Can I change plans later?",
    a: "Anytime. Upgrades apply immediately. Downgrades apply once your usage fits the smaller plan — we'll tell you exactly what to adjust.",
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <h1 className="text-[32px] font-semibold tracking-[-0.02em] text-ink-900">
        Simple pricing, 0% transaction fees
      </h1>
      <p className="mt-2 max-w-2xl text-[15px] text-ink-600">
        Start free in the Harbor. Every paid plan is $1 for the first month, and you can change or
        cancel whenever you like.
      </p>

      <PlanCards />

      <div className="mt-14">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-900">
          Compare plans
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-ink-200">
          <table className="w-full min-w-[640px] border-collapse bg-white text-[13px]">
            <thead>
              <tr className="border-b border-ink-200 text-left">
                <th className="px-4 py-3 font-medium text-ink-500"> </th>
                {PLANS.map((plan) => (
                  <th key={plan.id} className="px-4 py-3 font-semibold text-ink-900">{plan.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-2.5 text-ink-600">{row.label}</td>
                  {PLANS.map((plan) => (
                    <td key={plan.id} className="px-4 py-2.5 text-ink-800">{row.value(plan)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {faq.map((item) => (
          <div key={item.q}>
            <h3 className="text-[14px] font-semibold text-ink-900">{item.q}</h3>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-600">{item.a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
