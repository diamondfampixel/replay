import type { Metadata } from "next";
import Link from "next/link";
import {
  ExternalLink, FileText, Globe, Layout, Palette, Settings2, Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { listPages } from "@/lib/services/pages";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Dot } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { StoreStatusControl } from "@/components/admin/store-status";
import { NavigationEditor } from "@/components/admin/navigation-editor";
import { STORE_TONE } from "@/lib/status";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Store" };
export const dynamic = "force-dynamic";

export default async function StorePage() {
  const auth = await requireCapability("storefront:read");
  const ctx = await serviceContext();

  const [store, pages, nav, counts] = await Promise.all([
    prisma.store.findUniqueOrThrow({
      where: { id: ctx.storeId },
      include: { settings: true },
    }),
    listPages(ctx),
    prisma.navigationItem.findMany({
      where: { storeId: ctx.storeId },
      orderBy: { position: "asc" },
    }),
    Promise.all([
      prisma.product.count({ where: { storeId: ctx.storeId, status: "ACTIVE" } }),
      prisma.collection.count({ where: { storeId: ctx.storeId, visible: true } }),
    ]),
  ]);

  const [activeProducts, visibleCollections] = counts;
  const homepage = pages.find((page) => page.type === "HOME");
  const canWrite = can(auth.role, "storefront:write");
  const storefrontUrl = `/s/${store.slug}`;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Store"
        description="Your customer-facing storefront: what it looks like, what it links to, and whether it is live."
        actions={
          <>
            <Button asChild size="sm" variant="secondary">
              <a href={storefrontUrl} target="_blank" rel="noreferrer">
                <ExternalLink />
                View store
              </a>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin/store/themes">
                <Palette />
                Themes
              </Link>
            </Button>
            {canWrite && (
              <Button asChild size="sm" variant="primary">
                <Link href="/admin/store/editor">
                  <Layout />
                  Customize store
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Storefront preview</CardTitle>
              <Link href="/admin/store/editor" className="text-[12px] text-pine-700 hover:underline">
                Open editor
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="aspect-[16/10] overflow-hidden border-t border-ink-200 bg-ink-100">
                <iframe
                  src={storefrontUrl}
                  title="Storefront preview"
                  className="size-full"
                  loading="lazy"
                />
              </div>
              {homepage?.draftSections != null && (
                <div className="border-t border-[#f0dfb8] bg-[#fdf6e7] px-4 py-2.5 text-[12.5px] text-[#7a4e07]">
                  You have unpublished homepage changes.{" "}
                  <Link href="/admin/store/editor" className="font-medium underline">
                    Review and publish them
                  </Link>
                  .
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pages</CardTitle>
              <Link href="/admin/content" className="text-[12px] text-pine-700 hover:underline">
                Manage content
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-ink-200">
                {pages.map((page) => (
                  <li key={page.id} className="flex items-center gap-3 px-4 py-2.5">
                    <FileText className="size-3.5 shrink-0 text-ink-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink-800">
                        {page.type === "HOME" ? "Homepage" : page.title}
                      </p>
                      <p className="truncate text-[11.5px] text-ink-500">
                        {page.type === "HOME" ? "/" : `/pages/${page.slug}`} · updated {formatDate(page.updatedAt)}
                      </p>
                    </div>
                    {page.draftSections != null && <Badge tone="warning">draft changes</Badge>}
                    <Badge tone={page.published ? "success" : "neutral"}>
                      {page.published ? "Published" : "Draft"}
                    </Badge>
                    <Link
                      href={page.type === "HOME" ? "/admin/store/editor" : `/admin/content/${page.id}`}
                      className="text-[12px] text-pine-700 hover:underline"
                    >
                      Edit
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <NavigationEditor
            main={nav.filter((item) => item.group === "main").map((item) => ({ label: item.label, href: item.href }))}
            footer={nav.filter((item) => item.group === "footer").map((item) => ({ label: item.label, href: item.href }))}
            pages={pages.filter((page) => page.type !== "HOME").map((page) => ({ title: page.title, slug: page.slug }))}
            canWrite={canWrite}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-ink-500">Current</span>
                <Badge tone={STORE_TONE[store.status]}>
                  <Dot tone={store.status === "ACTIVE" ? "success" : "warning"} />
                  {store.status === "ACTIVE" ? "Live" : store.status.toLowerCase()}
                </Badge>
              </div>
              {canWrite && <StoreStatusControl status={store.status} />}
              <p className="text-[11.5px] text-ink-400">
                A draft or paused store returns a 404 to shoppers. The admin keeps working either way.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Domain</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <div className="flex items-center gap-2">
                <Globe className="size-3.5 text-ink-400" />
                <a href={storefrontUrl} target="_blank" rel="noreferrer" className="truncate text-pine-700 hover:underline">
                  {storefrontUrl}
                </a>
              </div>
              <p className="text-[12px] text-ink-500">{store.domain ?? "No domain assigned"}</p>
              <p className="rounded-md border border-ink-200 bg-ink-50 px-2.5 py-2 text-[11.5px] text-ink-500">
                Custom domains are not connected in this build. DNS verification and certificates are
                not implemented — your store is served from the path above.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Brand</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-500">Primary</span>
                <span className="flex items-center gap-2">
                  <span className="size-4 rounded border border-ink-200" style={{ background: store.primaryColor }} />
                  <code className="text-[12px] text-ink-700">{store.primaryColor}</code>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500">Secondary</span>
                <span className="flex items-center gap-2">
                  <span className="size-4 rounded border border-ink-200" style={{ background: store.secondaryColor }} />
                  <code className="text-[12px] text-ink-700">{store.secondaryColor}</code>
                </span>
              </div>
              <Button asChild size="sm" variant="secondary" className="w-full">
                <Link href="/admin/settings/brand">
                  <Palette />
                  Edit brand
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>At a glance</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <Row label="Live products" value={String(activeProducts)} href="/admin/products?status=ACTIVE" />
              <Row label="Visible collections" value={String(visibleCollections)} href="/admin/collections" />
              <Row label="Pages" value={String(pages.length)} href="/admin/content" />
              <Row label="Checkout" value={store.settings?.checkoutMode === "stripe" ? "Stripe" : "Simulated"} href="/admin/settings/payments" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ask the assistant</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                "Change the homepage hero to focus on free shipping",
                "Add a benefits section under the hero",
                "Write a new About page",
              ].map((prompt) => (
                <Link
                  key={prompt}
                  href={`/admin/assistant?prompt=${encodeURIComponent(prompt)}`}
                  className="flex items-start gap-2 rounded-md border border-ink-200 px-2.5 py-2 text-[12.5px] text-ink-700 hover:bg-ink-50"
                >
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-pine-600" />
                  {prompt}
                </Link>
              ))}
            </CardContent>
          </Card>

          <Button asChild size="sm" variant="secondary" className="w-full">
            <Link href="/admin/settings">
              <Settings2 />
              All store settings
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between hover:text-ink-900">
      <span className="text-ink-500">{label}</span>
      <span className="tabular font-medium text-ink-800">{value}</span>
    </Link>
  );
}
