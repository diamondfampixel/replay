import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { getPlatformEconomics, type EconomicsClass } from "@/lib/services/economics";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Platform economics" };
export const dynamic = "force-dynamic";

const usd = (value: number, digits = 2) => `$${value.toFixed(digits)}`;

const TONE: Record<EconomicsClass, string> = {
  "HEALTHY AI ECONOMICS": "bg-emerald-50 text-emerald-800 border-emerald-200",
  "AT-RISK AI ECONOMICS": "bg-amber-50 text-amber-800 border-amber-200",
  "UNPROFITABLE AT FULL USAGE": "bg-red-50 text-red-800 border-red-200",
  "NO DATA": "bg-ink-100 text-ink-600 border-ink-200",
};

const KIND_LABEL: Record<string, string> = {
  chat: "Chat (no tools)",
  chat_read: "Business question (read tools)",
  chat_write: "Store change (write tools)",
  chat_design: "Storefront design",
  variants: "A/B copy variants",
  onboarding: "Onboarding store build",
};

/**
 * Halyard's own economics: per-plan revenue against AI cost from the request
 * ledger. Platform operators only — every other signed-in user gets a 404,
 * exactly as if the route did not exist.
 */
export default async function PlatformEconomicsPage() {
  const ctx = await requireContext();
  if (!isPlatformAdmin(ctx.user.email)) notFound();

  const report = await getPlatformEconomics();
  const month = report.monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-400">Halyard · internal</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em] text-ink-900">Platform economics</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-ink-500">
          Subscription revenue against estimated Anthropic spend, {month}. AI is one cost among many
          (hosting, database, storage, email, payment fees, support), so a healthy figure here is not
          company profit — it is the AI share of each subscription staying small.
        </p>
      </div>

      <div
        className={`rounded-lg border px-4 py-3 text-[13px] ${
          report.dataMode === "production" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        <span className="font-semibold uppercase tracking-wide">
          {report.dataMode === "production" ? "Production data" : "Development / test data"}
        </span>{" "}
        — {report.dataModeReason} Demo and test organizations ({report.totals.demoOrganizations}) are excluded from the
        per-plan figures; {report.totals.realOrganizations} real organization{report.totals.realOrganizations === 1 ? "" : "s"} counted.
        Per-action costs are {report.assumptions.source === "observed" ? "observed from the ledger" : "assumed until the ledger holds enough requests"}:
        average {usd(report.assumptions.avgActionUsd, 3)}, design {usd(report.assumptions.designActionUsd, 3)}.
      </div>

      <section className="rounded-lg border border-ink-200 bg-white">
        <div className="border-b border-ink-200 px-4 py-3">
          <h2 className="text-[14px] font-semibold text-ink-900">By plan</h2>
          <p className="text-[12px] text-ink-500">
            Worst case = included allowance × cost of the most expensive action kind. Typical = 30% of the allowance at the average cost.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-ink-50 text-left font-mono text-[10.5px] uppercase tracking-wider text-ink-500">
              <tr>
                {["Plan", "Price", "Orgs", "Revenue (nominal)", "Allowance", "Avg actions / org", "Avg AI cost / org", "Max AI cost / org", "Gross after AI", "Worst-case AI", "Typical AI", "Spend ceiling", "Class"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.plans.map((row) => (
                <tr key={row.plan.id} className="border-t border-ink-100">
                  <td className="px-3 py-2 font-medium text-ink-900">{row.plan.name}</td>
                  <td className="px-3 py-2">{row.plan.monthly === 0 ? "Free" : `${usd(row.plan.monthly, 0)}/mo`}</td>
                  <td className="px-3 py-2">
                    {row.organizations - row.demoOrganizations}
                    {row.demoOrganizations > 0 && <span className="text-ink-400"> (+{row.demoOrganizations} demo)</span>}
                  </td>
                  <td className="px-3 py-2">{usd(row.revenueMonthly, 0)}</td>
                  <td className="px-3 py-2">{row.allowance}{row.plan.limits.aiStarterActions !== null ? " lifetime" : "/mo"}</td>
                  <td className="px-3 py-2">{row.actionsPerOrg.toFixed(1)}</td>
                  <td className="px-3 py-2">{usd(row.costPerOrg)}</td>
                  <td className="px-3 py-2">{usd(row.costPerOrgMax)}</td>
                  <td className="px-3 py-2">{row.plan.monthly === 0 ? "—" : usd(row.grossAfterAI)}</td>
                  <td className="px-3 py-2">{usd(row.worstCaseAI)}</td>
                  <td className="px-3 py-2">{usd(row.typicalAI)}</td>
                  <td className="px-3 py-2">{usd(row.spendCeiling, 0)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${TONE[row.classification]}`}>
                      {row.classification}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-ink-200 bg-white">
        <div className="border-b border-ink-200 px-4 py-3">
          <h2 className="text-[14px] font-semibold text-ink-900">By action kind</h2>
          <p className="text-[12px] text-ink-500">Cost per request this month, most expensive first.</p>
        </div>
        {report.kinds.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-ink-500">No AI requests recorded this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-ink-50 text-left font-mono text-[10.5px] uppercase tracking-wider text-ink-500">
                <tr>
                  {["Kind", "Requests", "Avg cost", "Max cost", "Avg output tokens", "Avg context tokens", "Safeguard stops", "Errors"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.kinds.map((row) => (
                  <tr key={row.kind} className="border-t border-ink-100">
                    <td className="px-3 py-2 font-medium text-ink-900">{KIND_LABEL[row.kind] ?? row.kind}</td>
                    <td className="px-3 py-2">{row.requests}</td>
                    <td className="px-3 py-2">{usd(row.avgCost, 3)}</td>
                    <td className="px-3 py-2">{usd(row.maxCost, 3)}</td>
                    <td className="px-3 py-2">{row.avgOutputTokens.toLocaleString()}</td>
                    <td className="px-3 py-2">{row.avgContextTokens.toLocaleString()}</td>
                    <td className="px-3 py-2">{row.guardStops}</td>
                    <td className="px-3 py-2">{row.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Requests this month", report.totals.requests.toLocaleString()],
          ["Estimated AI spend", usd(report.totals.costUsd)],
          ["Safeguard stops", report.totals.guardStops.toLocaleString()],
          ["Plans", PLANS.map((p) => `${p.name} ${p.limits.aiStarterActions ?? p.limits.aiActionsPerMonth}`).join(" · ")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-ink-200 bg-white px-4 py-3">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-ink-400">{label}</p>
            <p className="mt-1 text-[15px] font-semibold text-ink-900">{value}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
