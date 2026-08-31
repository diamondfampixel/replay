import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { getCustomerTags, listCustomers } from "@/lib/services/customers";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DemoTag, EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataToolbar, Pagination } from "@/components/admin/data-toolbar";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { NewCustomerButton } from "@/components/admin/customer-dialogs";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const auth = await requireCapability("customers:read");
  const ctx = await serviceContext();
  const params = await searchParams;

  const [result, tags, store] = await Promise.all([
    listCustomers(ctx, {
      q: params.q,
      tag: params.tag,
      sort: params.sort ?? "newest",
      page: params.page ? Number(params.page) : 1,
    }),
    getCustomerTags(ctx.storeId),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
  ]);

  const canWrite = can(auth.role, "customers:write");

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Customers"
        description={`${result.total} customer${result.total === 1 ? "" : "s"}`}
        actions={canWrite && <NewCustomerButton />}
      />

      <Card className="overflow-hidden">
        <DataToolbar
          searchPlaceholder="Search name or email…"
          filters={tags.length ? [{ key: "tag", label: "Tag", options: tags.map((tag) => ({ value: tag, label: tag })) }] : []}
          sortOptions={[
            { value: "newest", label: "Newest" },
            { value: "name", label: "Name A–Z" },
            { value: "spent_desc", label: "Highest spend" },
            { value: "orders_desc", label: "Most orders" },
          ]}
        />

        {result.rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers match"
            description="Customers are created automatically at checkout, or you can add one manually."
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH align="right">Orders</TH>
                  <TH align="right">Total spent</TH>
                  <TH>Last order</TH>
                  <TH>Created</TH>
                  <TH>Tags</TH>
                </tr>
              </THead>
              <TBody>
                {result.rows.map((customer) => (
                  <TR key={customer.id}>
                    <TD>
                      <Link href={`/admin/customers/${customer.id}`} className="flex items-center gap-1.5 font-medium text-ink-900 hover:underline">
                        {customer.firstName} {customer.lastName}
                        {customer.isDemo && <DemoTag label="Demo" />}
                      </Link>
                    </TD>
                    <TD className="text-ink-500">{customer.email}</TD>
                    <TD align="right" className="tabular">{customer.orders}</TD>
                    <TD align="right" className="tabular font-medium text-ink-900">
                      {formatMoney(customer.totalSpent, store.currency)}
                    </TD>
                    <TD className="whitespace-nowrap text-ink-500">
                      {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
                    </TD>
                    <TD className="whitespace-nowrap text-ink-500">{formatDate(customer.createdAt)}</TD>
                    <TD>
                      <span className="flex flex-wrap gap-1">
                        {customer.tags.map((tag) => (
                          <Badge key={tag} tone="outline">{tag}</Badge>
                        ))}
                        {customer.acceptsMarketing && <Badge tone="success">subscribed</Badge>}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}

        {result.total > 0 && (
          <Pagination page={result.page} pageCount={result.pageCount} total={result.total} perPage={result.perPage} />
        )}
      </Card>
    </div>
  );
}
