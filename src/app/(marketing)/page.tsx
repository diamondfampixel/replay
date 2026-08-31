import Link from "next/link";
import {
  BarChart3, FlaskConical, Layers, Mail, Package, Plug, Sparkles, Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CAPABILITIES = [
  { icon: Store, title: "Storefront that is data, not code", body: "Pages are ordered sections with JSON configuration. Edit them visually, or tell the assistant to change the hero — same underlying record either way." },
  { icon: Package, title: "A real catalog", body: "Products, variant matrices, images, categories, and collections that can be manual or rule-based. Inventory moves when orders come in." },
  { icon: BarChart3, title: "Analytics from your own events", body: "Page views, product views, cart events and purchases are collected by the platform and rolled up nightly into the dashboards you actually read." },
  { icon: FlaskConical, title: "Experiments with honest maths", body: "Assign traffic, record impressions and conversions, and see the uplift with a confidence read that refuses to declare a winner on thin data." },
  { icon: Mail, title: "Campaigns and reviews", body: "Draft campaigns with a block editor, collect subscribers from the storefront, and moderate real product reviews." },
  { icon: Plug, title: "Connections, declared honestly", body: "Every connector states whether it is fully wired, stores credentials only, or is a slot waiting to be built. Nothing shows a false green tick." },
];

const ASSISTANT_EXAMPLES = [
  "How has the store done this week?",
  "Create a 20% discount for everything until Sunday.",
  "Add a black hoodie for $60 as a draft.",
  "Make three headline variants for the homepage and test them.",
  "Which A/B test is winning?",
  "Write a campaign announcing the sale.",
];

export default function MarketingHome() {
  return (
    <main>
      <section className="border-b border-ink-200">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <Badge tone="outline" className="mb-5">
            <Sparkles className="size-3 text-pine-600" />
            AI commerce operating system
          </Badge>
          <h1 className="max-w-3xl text-[34px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink-900 sm:text-[52px]">
            Run the whole business from one place — or just describe what you want.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-600">
            Halyard is a complete commerce back office: storefront, catalog, orders, customers,
            analytics, experiments and campaigns. It also ships an assistant that operates all of
            it through the same validated services your team uses — with confirmation on anything
            that changes your live store.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="primary">
              <Link href="/signup">Create your store</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/login">Explore the demo business</Link>
            </Button>
          </div>
          <p className="mt-3 text-[12.5px] text-ink-400">
            The demo store is seeded with generated data for evaluation. It is labelled as such
            everywhere it appears.
          </p>
        </div>
      </section>

      <section className="border-b border-ink-200 bg-ink-50">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-ink-900">
                An assistant with hands, not just opinions
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-600">
                Most AI features summarise. This one executes. The model is given a registry of
                typed business tools — create a product, build a discount, edit a page section,
                start an experiment, draft a campaign — each with schema validation, a permission
                check and an audit record.
              </p>
              <ul className="mt-5 space-y-2.5 text-[14px] text-ink-700">
                <li className="flex gap-2.5">
                  <Layers className="mt-0.5 size-4 shrink-0 text-pine-600" />
                  Reads are immediate. Low-risk writes report what changed.
                </li>
                <li className="flex gap-2.5">
                  <Layers className="mt-0.5 size-4 shrink-0 text-pine-600" />
                  High-impact actions — pricing changes, deletions, sending email — stop and ask.
                </li>
                <li className="flex gap-2.5">
                  <Layers className="mt-0.5 size-4 shrink-0 text-pine-600" />
                  Every action is logged with its parameters, result and an undo where reversible.
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-ink-200 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                Things you can say
              </p>
              <ul className="mt-3 space-y-2">
                {ASSISTANT_EXAMPLES.map((example) => (
                  <li
                    key={example}
                    className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-[13.5px] text-ink-700"
                  >
                    {example}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-ink-200">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-ink-900">
            Everything connected to the same business data
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-600">
            A product created anywhere appears everywhere: in collections, on the storefront, in
            orders, in inventory, in analytics, in campaigns and in experiments.
          </p>
          <div className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <div key={capability.title}>
                <capability.icon className="size-4.5 text-pine-600" />
                <h3 className="mt-2.5 text-[14.5px] font-semibold text-ink-900">{capability.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-600">{capability.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-5 py-16 text-center">
          <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-ink-900">
            Start with a demo business, then make it yours
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[15px] text-ink-600">
            Create an account and either describe your business — Halyard generates the storefront —
            or open the seeded demo store and click through a business that already has history.
          </p>
          <Button asChild size="lg" variant="primary" className="mt-6">
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
