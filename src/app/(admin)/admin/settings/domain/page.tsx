import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Domain" };

export default async function DomainSettingsPage() {
  const ctx = await requireCapability("settings:read");
  const store = await prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId } });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Current address</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-500">Storefront URL</span>
            <a
              href={`/s/${store.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-pine-700 hover:underline"
            >
              /s/{store.slug}
              <ExternalLink className="size-3" />
            </a>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-500">Assigned domain</span>
            <span className="text-ink-800">{store.domain ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-500">Custom domain</span>
            <Badge tone="outline">Not configured</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Custom domains</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-[13px] text-ink-600">
          <p>
            Connecting your own domain requires DNS verification, certificate issuance and
            host-based routing. None of that is implemented in this build, so there is no form
            here that would appear to work and then do nothing.
          </p>
          <p>
            The data model already carries a <code className="rounded bg-ink-100 px-1 py-0.5 text-[11.5px]">customDomain</code>{" "}
            field on your store, and the storefront resolves by slug today — adding host resolution
            is the remaining piece.
          </p>
          <p>
            <Link href="/admin/integrations/custom_domain" className="text-pine-700 underline">
              See the connector
            </Link>{" "}
            for what would be involved.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
