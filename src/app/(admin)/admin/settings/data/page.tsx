import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { can } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoDataPanel } from "@/components/admin/demo-data-panel";
import { DeleteOrganizationCard } from "@/components/admin/danger-zone";

export const metadata: Metadata = { title: "Data" };
export const dynamic = "force-dynamic";

export default async function DataSettingsPage() {
  const ctx = await requireCapability("settings:read");
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
    select: { name: true },
  });

  const [
    products, orders, customers, reviews, events, daily,
    experiments, campaigns, subscribers, discounts, media, store,
  ] = await Promise.all([
    prisma.product.count({ where: { storeId: ctx.storeId, isDemo: true } }),
    prisma.order.count({ where: { storeId: ctx.storeId, isDemo: true } }),
    prisma.customer.count({ where: { storeId: ctx.storeId, isDemo: true } }),
    prisma.review.count({ where: { storeId: ctx.storeId, isDemo: true } }),
    prisma.analyticsEvent.count({ where: { storeId: ctx.storeId, isDemo: true } }),
    prisma.analyticsDaily.count({ where: { storeId: ctx.storeId, isDemo: true } }),
    prisma.experiment.count({ where: { storeId: ctx.storeId, isDemo: true } }),
    prisma.emailCampaign.count({ where: { storeId: ctx.storeId, isDemo: true } }),
    prisma.emailSubscriber.count({ where: { storeId: ctx.storeId, isDemo: true } }),
    prisma.discount.count({ where: { storeId: ctx.storeId, isDemo: true } }),
    prisma.mediaAsset.count({ where: { storeId: ctx.storeId, isDemo: true } }),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { isDemo: true } }),
  ]);

  const counts = [
    { label: "Products", value: products },
    { label: "Orders", value: orders },
    { label: "Customers", value: customers },
    { label: "Reviews", value: reviews },
    { label: "Analytics events", value: events },
    { label: "Daily rollups", value: daily },
    { label: "Experiments", value: experiments },
    { label: "Campaigns", value: campaigns },
    { label: "Subscribers", value: subscribers },
    { label: "Discounts", value: discounts },
    { label: "Media files", value: media },
  ];
  const total = counts.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>How demo data works</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-[13px] leading-relaxed text-ink-600">
          <p>
            Every seeded record carries an <code className="rounded bg-ink-100 px-1 py-0.5 text-[11.5px]">isDemo</code>{" "}
            flag in the database. That is what lets the interface label demo figures, and what makes
            it possible to remove them cleanly when you start trading for real.
          </p>
          <p>
            Demo revenue, traffic and experiment results are generated for development. They are not
            real business performance and are never presented as such.
          </p>
          <p>
            Anything you create yourself — a product you added, an order a real shopper placed — is
            not flagged and is never touched by the purge below.
          </p>
        </CardContent>
      </Card>

      <DemoDataPanel
        counts={counts}
        total={total}
        storeIsDemo={store.isDemo}
        canWrite={can(ctx.role, "settings:write")}
      />

      <Card>
        <CardHeader><CardTitle>Export your data</CardTitle></CardHeader>
        <CardContent>
          <p className="text-[13px] text-ink-600">
            Take your data with you as CSV, on any plan. Demo rows are included and flagged in an
            isDemo column.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
            <a className="rounded-md border border-ink-200 bg-white px-3 py-1.5 font-medium text-ink-800 hover:border-ink-400" href="/api/admin/export/orders" download>Orders</a>
            <a className="rounded-md border border-ink-200 bg-white px-3 py-1.5 font-medium text-ink-800 hover:border-ink-400" href="/api/admin/export/customers" download>Customers</a>
            <a className="rounded-md border border-ink-200 bg-white px-3 py-1.5 font-medium text-ink-800 hover:border-ink-400" href="/api/admin/export/products" download>Products</a>
          </div>
        </CardContent>
      </Card>

      <DeleteOrganizationCard organizationName={organization.name} isOwner={ctx.role === "OWNER"} />
    </div>
  );
}
