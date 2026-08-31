import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { listDiscounts } from "@/lib/services/discounts";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DemoTag, EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { DISCOUNT_TONE } from "@/lib/status";

export const metadata: Metadata = { title: "Discounts" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  PERCENTAGE: "Percentage",
  FIXED_AMOUNT: "Fixed amount",
  FREE_SHIPPING: "Free shipping",
  BUY_X_GET_Y: "Buy X get Y",
};

export default async function DiscountsPage() {
  const auth = await requireCapability("marketing:read");
  const ctx = await serviceContext();
  const [discounts, store] = await Promise.all([
    listDiscounts(ctx),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
  ]);
  const canWrite = can(auth.role, "marketing:write");

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Discounts"
        description="Codes and automatic discounts. Checkout enforces every rule you set here."
        actions={
          canWrite && (
            <Button asChild size="sm" variant="primary">
              <Link href="/admin/discounts/new">
                <Plus />
                Create discount
              </Link>
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        {discounts.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No discounts yet"
            description="Create a code customers can enter at checkout, or an automatic discount that applies on its own."
            action={canWrite ? { label: "Create discount", href: "/admin/discounts/new" } : undefined}
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Discount</TH>
                  <TH>Type</TH>
                  <TH align="right">Value</TH>
                  <TH>Status</TH>
                  <TH align="right">Used</TH>
                  <TH>Active period</TH>
                </tr>
              </THead>
              <TBody>
                {discounts.map((discount) => (
                  <TR key={discount.id}>
                    <TD>
                      <Link href={`/admin/discounts/${discount.id}`} className="group block">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium text-ink-900 group-hover:underline">{discount.title}</span>
                          {discount.isDemo && <DemoTag label="Demo" />}
                        </span>
                        <span className="block font-mono text-[11.5px] text-ink-500">
                          {discount.code ?? "Automatic"}
                        </span>
                      </Link>
                    </TD>
                    <TD className="text-ink-600">{TYPE_LABEL[discount.type]}</TD>
                    <TD align="right" className="tabular">
                      {discount.type === "PERCENTAGE" ? `${toNumber(discount.value)}%`
                        : discount.type === "FIXED_AMOUNT" ? formatMoney(toNumber(discount.value), store.currency)
                        : "—"}
                    </TD>
                    <TD>
                      <Badge tone={DISCOUNT_TONE[discount.effectiveStatus]}>
                        {discount.effectiveStatus.toLowerCase()}
                      </Badge>
                    </TD>
                    <TD align="right" className="tabular">
                      {discount.usageCount}
                      {discount.usageLimit ? ` / ${discount.usageLimit}` : ""}
                    </TD>
                    <TD className="whitespace-nowrap text-ink-500">
                      {formatDate(discount.startsAt)}
                      {discount.endsAt ? ` → ${formatDate(discount.endsAt)}` : " → no end date"}
                    </TD>
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
