import type { Metadata } from "next";
import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { listCollections } from "@/lib/services/collections";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const auth = await requireCapability("catalog:read");
  const ctx = await serviceContext();
  const collections = await listCollections(ctx);
  const canWrite = can(auth.role, "catalog:write");

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Collections"
        description="Merchandising groups shown on the storefront. Manual collections are curated by hand; rule-based ones update themselves."
        actions={
          canWrite && (
            <Button asChild size="sm" variant="primary">
              <Link href="/admin/collections/new">
                <Plus />
                Create collection
              </Link>
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        {collections.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No collections yet"
            description="Group products for the storefront — a summer edit, best sellers, or everything under $50."
            action={canWrite ? { label: "Create collection", href: "/admin/collections/new" } : undefined}
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Collection</TH>
                  <TH>Type</TH>
                  <TH align="right">Products</TH>
                  <TH>Visibility</TH>
                  <TH>Updated</TH>
                </tr>
              </THead>
              <TBody>
                {collections.map((collection) => (
                  <TR key={collection.id}>
                    <TD>
                      <Link href={`/admin/collections/${collection.id}`} className="flex items-center gap-2.5 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={collection.imageUrl ?? "/placeholder.svg"}
                          alt=""
                          className="size-9 shrink-0 rounded border border-ink-200 object-cover"
                          loading="lazy"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink-900 group-hover:underline">
                            {collection.title}
                          </span>
                          <span className="block truncate text-[11.5px] text-ink-500">
                            /collections/{collection.slug}
                          </span>
                        </span>
                      </Link>
                    </TD>
                    <TD>
                      <Badge tone={collection.type === "AUTOMATIC" ? "info" : "neutral"}>
                        {collection.type === "AUTOMATIC" ? "Rule-based" : "Manual"}
                      </Badge>
                    </TD>
                    <TD align="right" className="tabular">{collection.productCount}</TD>
                    <TD>
                      <Badge tone={collection.visible ? "success" : "outline"}>
                        {collection.visible ? "Visible" : "Hidden"}
                      </Badge>
                    </TD>
                    <TD className="text-ink-500">{relativeTime(collection.updatedAt)}</TD>
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
