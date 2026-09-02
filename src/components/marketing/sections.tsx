import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS } from "@/lib/plans";
import { Reveal, CountUp } from "@/components/marketing/motion";
import { TrackView } from "@/components/marketing/page-view";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { FaqList } from "@/components/marketing/faq";
import {
  ABTestDemo, AssistantDemo, ConfirmGateDemo, CustomerDemo,
  OrderToastDemo, RevenueChartDemo, StorefrontMiniDemo, WindowFrame,
} from "@/components/marketing/demo-cards";
import { cn } from "@/lib/utils";

function SectionShell({
  id,
  eyebrow,
  title,
  lede,
  children,
  className,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-24 sm:py-32", className)}>
      <div className="mx-auto w-full max-w-6xl px-5">
        <Reveal>
          <p className="font-mono text-[11.5px] font-medium uppercase tracking-[0.24em] text-glow-green">
            {eyebrow}
          </p>
          <h2
            className="mt-3 max-w-xl font-display text-[30px] font-semibold leading-[1.08] tracking-[-0.025em] text-night-text sm:text-[40px]"
            style={{ textWrap: "balance" }}
          >
            {title}
          </h2>
          {lede && <p className="mt-4 max-w-lg text-[15.5px] leading-relaxed text-night-muted">{lede}</p>}
        </Reveal>
        {children}
      </div>
    </section>
  );
}

function Point({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-glow-green/15">
        <Check className="size-3 text-glow-green" />
      </span>
      <div>
        <p className="text-[14.5px] font-medium text-night-text">{title}</p>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-night-muted">{body}</p>
      </div>
    </div>
  );
}

/** 2 — what Halyard is, in one breath. */
export function IntroSection() {
  return (
    <section className="border-y border-night-line bg-night-900 py-16">
      <div className="mx-auto w-full max-w-6xl px-5">
        <Reveal>
          <p className="max-w-3xl font-display text-[22px] font-medium leading-snug tracking-[-0.015em] text-night-text sm:text-[28px]">
            Most platforms help you <em className="not-italic text-glow-green">build</em> a store.
            Halyard is built for what comes after — the running of it.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[12px] uppercase tracking-[0.2em] text-night-muted">
            {["Build", "Launch", "Sell", "Operate", "Optimize", "Grow"].map((verb, index) => (
              <span key={verb} className="flex items-center gap-8">
                {index > 0 && <span className="text-night-faint">·</span>}
                {verb}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** 3 — the assistant doing real work, with the safety gate on show. */
export function AssistantSection() {
  return (
    <SectionShell
      id="product"
      eyebrow="The assistant"
      title="Ask. It does the work."
      lede="Not a chatbot bolted onto a dashboard. The assistant runs your store through 58 typed, permission-checked tools — and every action lands in an audit log you can undo."
    >
      <TrackView event="demo_viewed">
        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1.2fr_1fr]">
          <Reveal delay={0.1}>
            <div className="space-y-4">
              <AssistantDemo
                command="Which products are underperforming this month?"
                toolName="get_top_products"
                toolSummary="read · instant"
                reply="Three products have traffic but no sales: the Canvas Tote, Enamel Mug, and Wool Beanie. The tote has 214 views and zero orders — its photos may be the problem. Want me to draft new copy or test a lower price?"
                className="max-w-md"
              />
              <div className="max-w-md pl-8">
                <ConfirmGateDemo />
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="space-y-6 lg:pt-6">
              <Point
                title="Reads answer instantly"
                body="Sales, stock, customers, experiments — asked in plain language, answered from your real data."
              />
              <Point
                title="Big changes stop at a gate"
                body="Bulk price changes, publishing, anything consequential shows you exactly what will happen and waits for your confirmation. One approval executes exactly once."
              />
              <Point
                title="Everything is on the record"
                body="Every action the AI takes is logged with what, when, and why — and the reversible ones have an undo button."
              />
            </div>
          </Reveal>
        </div>
      </TrackView>
    </SectionShell>
  );
}

/** 4 — building the storefront. */
export function BuildSection() {
  return (
    <SectionShell
      eyebrow="Build"
      title="A storefront you shape section by section."
      lede="Fourteen section types, a visual editor with live preview, and a draft you publish when it's ready. The assistant edits pages through the same safe structure — it never generates raw code onto your store."
    >
      <div className="mt-12 grid items-center gap-8 lg:grid-cols-2">
        <Reveal delay={0.1}>
          <div className="relative mx-auto w-full max-w-sm">
            <StorefrontMiniDemo />
            <div className="absolute -right-6 -top-6 hidden w-44 sm:block">
              <WindowFrame>
                <div className="space-y-1.5 p-2.5">
                  <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-400">Sections</p>
                  {["Hero", "Featured products", "Benefits", "Newsletter"].map((section, index) => (
                    <div
                      key={section}
                      className={cn(
                        "rounded border px-2 py-1 text-[10px]",
                        index === 0 ? "border-pine-300 bg-pine-50 text-pine-800" : "border-ink-200 text-ink-600",
                      )}
                    >
                      {section}
                    </div>
                  ))}
                </div>
              </WindowFrame>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="space-y-6">
            <Point title="Draft and publish are separate" body="Work in a draft, preview on desktop and mobile, publish when it's right. Visitors never see half-finished pages." />
            <Point title="Your products, your brand" body="Colors, type, navigation, pages — free accounts get the full editor. A good-looking store is not a paid feature." />
            <Point title="The AI is a co-builder" body="“Rewrite the hero for the holiday drop” edits the same sections you do, behind the same confirmation gate." />
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}

/** 5 — operating: orders, customers, analytics. */
export function OperateSection() {
  return (
    <SectionShell
      eyebrow="Operate"
      title="The whole business on one screen."
      lede="Orders with full timelines, customers with real histories, revenue that reconciles to the cent — computed live from your store, never hardcoded."
    >
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        <Reveal delay={0.05}>
          <div className="space-y-3">
            <OrderToastDemo />
            <WindowFrame title="Orders">
              <div className="space-y-1.5 p-3">
                {[
                  ["#4580", "Fulfilled", "$74.20"],
                  ["#4579", "Paid", "$132.00"],
                  ["#4578", "Refunded", "$54.15"],
                ].map(([number, status, total]) => (
                  <div key={number} className="flex items-center justify-between text-[10.5px]">
                    <span className="font-medium text-ink-800">{number}</span>
                    <span className="text-ink-400">{status}</span>
                    <span className="font-medium text-ink-800" style={{ fontVariantNumeric: "tabular-nums" }}>{total}</span>
                  </div>
                ))}
              </div>
            </WindowFrame>
          </div>
        </Reveal>
        <Reveal delay={0.15}><CustomerDemo /></Reveal>
        <Reveal delay={0.25}><RevenueChartDemo /></Reveal>
      </div>
      <Reveal delay={0.3}>
        <div className="mt-10 flex flex-wrap gap-x-12 gap-y-6 border-t border-night-line pt-8">
          {[
            { value: 40, suffix: "", label: "database models behind the admin" },
            { value: 58, suffix: "", label: "actions the assistant can take" },
            { value: 0, suffix: "%", label: "platform fee on your sales" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-[30px] font-semibold text-night-text">
                <CountUp to={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-1 max-w-[180px] text-[12.5px] text-night-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </SectionShell>
  );
}

/** 6 — growth: A/B testing with honest statistics. */
export function GrowSection() {
  return (
    <SectionShell
      eyebrow="Grow"
      title="Test ideas on real traffic. Trust the answer."
      lede="Change a headline, a price, an offer — Halyard splits your visitors, measures conversions, and runs a real significance test. If the data is thin, it says “not enough visitors yet” instead of crowning a fake winner."
    >
      <div className="mt-12 grid items-start gap-8 lg:grid-cols-2">
        <Reveal delay={0.1}>
          <div className="mx-auto w-full max-w-sm"><ABTestDemo /></div>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="space-y-6">
            <Point title="Server-side, no flicker" body="Visitors are assigned before the page renders. No flash of the wrong version, no client-side hacks." />
            <Point title="The AI proposes tests" body="Ask for headline alternatives and the assistant drafts genuinely different angles — then measures which one sells." />
            <Point title="Email built in" body="Campaigns and subscriber lists live in the same system as everything else, so a discount, a banner, and an email are one conversation." />
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}

/** 7 — why one system. */
export function ReplaceStackSection() {
  const fragments = ["Store builder", "Analytics suite", "Email tool", "A/B platform", "Spreadsheet of doom"];
  return (
    <section className="border-y border-night-line bg-night-900 py-24">
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <h2 className="max-w-md font-display text-[30px] font-semibold leading-[1.08] tracking-[-0.025em] text-night-text sm:text-[36px]">
              Five tabs, five bills, five logins — or one system that already knows your store.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-night-muted">
              When the storefront, the orders, the analytics, and the experiments share one brain,
              the AI can actually connect them: a product that isn&apos;t selling becomes a price
              test, a banner, and an email — in one conversation.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="space-y-2.5">
              {fragments.map((fragment) => (
                <div
                  key={fragment}
                  className="flex items-center justify-between rounded-lg border border-night-line bg-night-850 px-4 py-2.5 text-[13.5px] text-night-faint"
                >
                  <span className="line-through decoration-night-faint/60">{fragment}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider">replaced</span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border border-glow-green/30 bg-glow-green/10 px-4 py-3 text-[14px] font-medium text-night-text">
                <span>Halyard</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-glow-green">one system</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** 8 — pricing summary. */
export function PricingSection() {
  return (
    <SectionShell
      id="pricing-summary"
      eyebrow="Pricing"
      title="Free to build. Paid when you're ready to run it for real."
      lede="Build the whole store on the free plan — full editor, full admin, AI included. Upgrade when you want live checkout, your own domain, and room to grow. 0% platform fees on every plan."
    >
      <TrackView event="pricing_viewed">
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.id} delay={index * 0.07}>
              <div
                className={cn(
                  "flex h-full flex-col rounded-xl border p-5",
                  plan.highlight
                    ? "border-glow-green/40 bg-night-800"
                    : "border-night-line bg-night-900",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-semibold text-night-text">{plan.name}</p>
                  {plan.highlight && (
                    <span className="rounded-full bg-glow-green/15 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-glow-green">
                      Popular
                    </span>
                  )}
                </div>
                <p className="mt-3 font-display text-[26px] font-semibold text-night-text">
                  {plan.monthly === 0 ? "Free" : `$${plan.annualMonthly}`}
                  {plan.monthly > 0 && <span className="ml-1 text-[12px] font-normal text-night-faint">/mo annual</span>}
                </p>
                <p className="mt-1 min-h-9 text-[12px] leading-snug text-night-muted">{plan.tagline}</p>
                <p className="mt-auto pt-3 text-[12px] text-night-muted">
                  {plan.limits.aiStarterActions !== null
                    ? `${plan.limits.aiStarterActions} AI actions to build with`
                    : `${plan.limits.aiActionsPerMonth!.toLocaleString()} AI actions / month`}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.3}>
          <p className="mt-6 text-[13px] text-night-muted">
            Full comparison on the{" "}
            <Link href="/pricing" className="text-night-text underline underline-offset-4 hover:text-white">
              pricing page
            </Link>
            . Every paid plan is $1 for the first month.
          </p>
        </Reveal>
      </TrackView>
    </SectionShell>
  );
}

/** 9 — FAQ. */
export function FaqSection() {
  return (
    <SectionShell id="faq" eyebrow="Questions" title="The honest answers.">
      <div className="mt-10 max-w-2xl">
        <FaqList
          items={[
            {
              q: "What actually is Halyard?",
              a: "An ecommerce operating system: storefront, products, orders, customers, analytics, A/B testing, and email in one place — run through an AI assistant that takes real, permission-checked actions instead of just chatting.",
            },
            {
              q: "Is the AI safe to let near my store?",
              a: "It works through typed tools with role permissions, and anything consequential — bulk price changes, publishing, big edits — stops at a confirmation screen first. Every action is logged, and reversible ones can be undone.",
            },
            {
              q: "What does the waitlist get me?",
              a: "A spot in early access. We're opening gradually so every store gets real attention. When your spot opens, you'll get an invite to create your account — the free plan really is free.",
            },
            {
              q: "Do you take a cut of my sales?",
              a: "No. 0% platform transaction fees on every plan, including free. Payments go through your own payment provider at their standard rates.",
            },
            {
              q: "Can I build something real on the free plan?",
              a: "Yes — full admin, full storefront editor, 50 products, and AI actions to build with. Paid plans are about operating: live checkout, custom domains, more AI, email, and growth tools.",
            },
          ]}
        />
      </div>
    </SectionShell>
  );
}

/** 10 — final call to action. */
export function FinalCtaSection({ cta }: { cta: { label: string; kind: "waitlist" | "signup" } }) {
  return (
    <section id="join" className="relative overflow-hidden py-28 sm:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(50% 60% at 50% 100%, rgba(61,189,139,0.08), transparent 70%)" }}
      />
      <div className="relative mx-auto w-full max-w-2xl px-5 text-center">
        <Reveal>
          <h2 className="font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-night-text sm:text-[46px]">
            A new kind of commerce platform is coming.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-night-muted">
            Join the list and be there when the doors open. Free to build — no card required.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-8 flex justify-center">
            {cta.kind === "waitlist" ? (
              <WaitlistForm ctaLabel={cta.label} />
            ) : (
              <Link
                href="/signup"
                className="rounded-lg bg-night-text px-6 py-3 text-[15px] font-medium text-night-950 transition-colors hover:bg-white"
              >
                {cta.label}
              </Link>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
