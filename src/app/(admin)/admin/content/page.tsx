import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { listPages } from "@/lib/services/pages";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Content" };
export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const auth = await requireCapability("content:read");
  const ctx = await serviceContext();

  const [pages, store] = await Promise.all([
    listPages(ctx),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { slug: true } }),
  ]);
  const canWrite = can(auth.role, "content:write");
  const contentPages = pages.filter((page) => page.type !== "HOME");

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader
        title="Content"
        description="Standalone pages on your storefront — about, contact, policies and anything else."
        actions={
          canWrite && (
            <Button asChild size="sm" variant="primary">
              <Link href="/admin/content/new">
                <Plus />
                New page
              </Link>
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        {contentPages.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No content pages yet"
            description="Add an about page, shipping policy or FAQ. The homepage is edited in the store editor."
            action={canWrite ? { label: "Create a page", href: "/admin/content/new" } : undefined}
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Page</TH>
                  <TH>URL</TH>
                  <TH>Status</TH>
                  <TH>In navigation</TH>
                  <TH>Updated</TH>
                </tr>
              </THead>
              <TBody>
                {contentPages.map((page) => (
                  <TR key={page.id}>
                    <TD>
                      <Link href={`/admin/content/${page.id}`} className="font-medium text-ink-900 hover:underline">
                        {page.title}
                      </Link>
                    </TD>
                    <TD>
                      {page.published ? (
                        <a
                          href={`/s/${store.slug}/pages/${page.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[12px] text-pine-700 hover:underline"
                        >
                          /pages/{page.slug}
                        </a>
                      ) : (
                        <span className="font-mono text-[12px] text-ink-400">/pages/{page.slug}</span>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={page.published ? "success" : "neutral"}>
                        {page.published ? "Published" : "Draft"}
                      </Badge>
                    </TD>
                    <TD className="text-ink-500">{page.showInNav ? "Yes" : "—"}</TD>
                    <TD className="whitespace-nowrap text-ink-500">{formatDate(page.updatedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
