import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Features" };

const GROUPS = [
  {
    title: "Storefront",
    items: [
      ["Section-based pages", "Homepages and landing pages are ordered sections with JSON configuration — safe for both a visual editor and an AI to modify."],
      ["Visual editor", "Add, reorder, duplicate, hide and delete sections; edit copy, images, alignment, spacing and backgrounds with a live preview and a mobile toggle."],
      ["Content pages", "About, contact, FAQ, shipping, returns, privacy and terms with rich text, slugs, SEO fields and visibility."],
      ["Cart and checkout", "Persistent cart, discount codes, and a development checkout that creates genuine orders. Architected so Stripe drives payment state when connected."],
    ],
  },
  {
    title: "Catalog and operations",
    items: [
      ["Products", "Variant matrices across any option axes, per-variant price, SKU, inventory and image; compare-at pricing, cost, tags, vendor, SEO and slug."],
      ["Collections", "Manual collections, or automatic ones driven by rules on tag, price, category, vendor and inventory — evaluated live."],
      ["Categories", "A separate hierarchical classification from collections, so merchandising and taxonomy do not fight."],
      ["Orders", "Full detail view with items, totals, payment and fulfillment state, address snapshots, a timeline, notes, tracking, refunds and cancellation."],
      ["Customers", "Profiles with lifetime value, average order value, order history, addresses, tags, notes and a timeline."],
      ["Discounts", "Percentage, fixed amount, free shipping and buy X get Y, with scoping, minimums, usage limits and scheduling. Checkout enforces every rule."],
    ],
  },
  {
    title: "Measurement",
    items: [
      ["Event collection", "Page views, product views, collection views, cart changes, checkout starts, purchases and email signups, with session, source, UTM and device."],
      ["Dashboards", "Revenue, orders, visitors, conversion, AOV, units and refunds with period-over-period comparison across six presets plus custom ranges."],
      ["Breakdowns", "Sales by product and collection, traffic by source and device, and a five-step conversion funnel."],
      ["A/B testing", "Deterministic variant assignment, impression and conversion recording, uplift, revenue per visitor, and a confidence read that will not call a winner on thin data."],
    ],
  },
  {
    title: "AI",
    items: [
      ["Tool calling", "A registry of typed business tools. The model chooses; the server validates with Zod, checks the caller's role, executes and logs."],
      ["Risk tiers", "Reads run freely, low-risk writes report what changed, and high-impact actions stop for explicit confirmation before touching your live store."],
      ["Store builder", "Describe the business and get a configured homepage — as section records you can then edit by hand."],
      ["Action log and undo", "Every AI action stores its prompt, tool, parameters, result and status, with undo where the operation is reversible."],
    ],
  },
];

export default function FeaturesPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-16">
      <h1 className="text-[32px] font-semibold tracking-[-0.02em] text-ink-900">
        What Halyard actually does
      </h1>
      <p className="mt-2 max-w-2xl text-[15px] text-ink-600">
        Everything listed here is implemented and reads or writes real database records.
      </p>

      <div className="mt-10 space-y-10">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              {group.title}
            </h2>
            <dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {group.items.map(([title, body]) => (
                <div key={title}>
                  <dt className="text-[14px] font-semibold text-ink-900">{title}</dt>
                  <dd className="mt-1 text-[13.5px] leading-relaxed text-ink-600">{body}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Button asChild variant="primary">
          <Link href="/signup">Create your store</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/pricing">See pricing</Link>
        </Button>
      </div>
    </main>
  );
}
