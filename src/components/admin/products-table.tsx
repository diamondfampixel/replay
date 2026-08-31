"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, MoreHorizontal, Package, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { DemoTag } from "@/components/ui/states";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/admin/confirm";
import { formatMoney, formatNumber } from "@/lib/money";
import { relativeTime } from "@/lib/format";
import { PRODUCT_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ProductRow } from "@/lib/services/products";
import {
  deleteProductsAction, duplicateProductAction, setProductStatusAction,
} from "@/app/actions/catalog";

export function ProductsTable({
  rows,
  currency,
  canWrite,
}: {
  rows: ProductRow[];
  currency: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);

  const allSelected = rows.length > 0 && selected.length === rows.length;

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      if (result.message) toast.success(result.message);
      setSelected([]);
      setConfirmDelete(null);
      router.refresh();
    });
  }

  if (!rows.length) {
    return (
      <EmptyState
        icon={Package}
        title="No products match"
        description="Adjust your search or filters, or add your first product."
        action={canWrite ? { label: "Create product", href: "/admin/products/new" } : undefined}
      />
    );
  }

  return (
    <>
      {selected.length > 0 && canWrite && (
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 bg-ink-50 px-3 py-2">
          <span className="text-[12.5px] font-medium text-ink-700">
            {selected.length} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" disabled={pending}
              onClick={() => run(() => setProductStatusAction(selected, "ACTIVE"))}>
              Set active
            </Button>
            <Button size="sm" variant="secondary" disabled={pending}
              onClick={() => run(() => setProductStatusAction(selected, "DRAFT"))}>
              Set draft
            </Button>
            <Button size="sm" variant="secondary" disabled={pending}
              onClick={() => run(() => setProductStatusAction(selected, "ARCHIVED"))}>
              <Archive />
              Archive
            </Button>
            <Button size="sm" variant="dangerOutline" disabled={pending}
              onClick={() => setConfirmDelete(selected)}>
              <Trash2 />
              Delete
            </Button>
          </div>
        </div>
      )}

      <TableWrap>
        <Table>
          <THead>
            <tr>
              {canWrite && (
                <TH className="w-9">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => setSelected(checked ? rows.map((r) => r.id) : [])}
                    aria-label="Select all products"
                  />
                </TH>
              )}
              <TH>Product</TH>
              <TH>Status</TH>
              <TH align="right">Inventory</TH>
              <TH align="right">Price</TH>
              <TH>Category</TH>
              <TH align="right">Sales</TH>
              <TH align="right">Revenue</TH>
              <TH>Updated</TH>
              <TH className="w-9" />
            </tr>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id}>
                {canWrite && (
                  <TD>
                    <Checkbox
                      checked={selected.includes(row.id)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) =>
                          checked ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                        )
                      }
                      aria-label={`Select ${row.title}`}
                    />
                  </TD>
                )}
                <TD>
                  <Link href={`/admin/products/${row.id}`} className="flex items-center gap-2.5 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.imageUrl ?? "/placeholder.svg"}
                      alt=""
                      className="size-9 shrink-0 rounded border border-ink-200 object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-ink-900 group-hover:underline">
                          {row.title}
                        </span>
                        {row.isDemo && <DemoTag label="Demo" />}
                      </span>
                      {row.variantCount > 0 && (
                        <span className="block text-[11.5px] text-ink-500">
                          {row.variantCount} variants
                        </span>
                      )}
                    </span>
                  </Link>
                </TD>
                <TD>
                  <Badge tone={PRODUCT_TONE[row.status]}>{row.status.toLowerCase()}</Badge>
                </TD>
                <TD align="right">
                  <span
                    className={cn(
                      "tabular",
                      !row.trackInventory ? "text-ink-400"
                      : row.inventory <= 0 ? "text-[var(--color-signal-negative)]"
                      : row.inventory <= 10 ? "text-[var(--color-signal-warning)]"
                      : "text-ink-700",
                    )}
                  >
                    {row.trackInventory ? formatNumber(row.inventory) : "Not tracked"}
                  </span>
                </TD>
                <TD align="right">
                  <span className="tabular font-medium text-ink-900">
                    {formatMoney(row.price, currency)}
                  </span>
                  {row.compareAtPrice && row.compareAtPrice > row.price && (
                    <span className="tabular ml-1.5 text-[11.5px] text-ink-400 line-through">
                      {formatMoney(row.compareAtPrice, currency)}
                    </span>
                  )}
                </TD>
                <TD className="text-ink-500">{row.categoryName ?? "—"}</TD>
                <TD align="right" className="tabular">{formatNumber(row.unitsSold)}</TD>
                <TD align="right" className="tabular">{formatMoney(row.revenue, currency)}</TD>
                <TD className="whitespace-nowrap text-ink-500">{relativeTime(row.updatedAt)}</TD>
                <TD>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                        aria-label={`Actions for ${row.title}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/products/${row.id}`}>
                          <Pencil />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      {canWrite && (
                        <>
                          <DropdownMenuItem onSelect={() => run(() => duplicateProductAction(row.id))}>
                            <Copy />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => run(() => setProductStatusAction([row.id], "ARCHIVED"))}
                          >
                            <Archive />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onSelect={() => setConfirmDelete([row.id])}>
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableWrap>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.length ?? 0} product${confirmDelete?.length === 1 ? "" : "s"}?`}
        description="This permanently removes the products, their variants and images. Past order line items keep their recorded title and price. This cannot be undone."
        confirmLabel="Delete permanently"
        destructive
        loading={pending}
        onConfirm={() => confirmDelete && run(() => deleteProductsAction(confirmDelete))}
      />
    </>
  );
}
