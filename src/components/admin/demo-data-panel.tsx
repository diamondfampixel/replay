"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/admin/confirm";
import { formatNumber } from "@/lib/money";
import { purgeDemoDataAction } from "@/app/actions/settings";

export function DemoDataPanel({
  counts, total, storeIsDemo, canWrite,
}: {
  counts: Array<{ label: string; value: number }>;
  total: number;
  storeIsDemo: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Seeded records</CardTitle>
          <Badge tone={storeIsDemo ? "warning" : "success"}>
            {storeIsDemo ? "Demo store" : "No demo flag"}
          </Badge>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-[13px] text-ink-600">
              This store contains no seeded data. Everything here was created by you or by real
              storefront activity.
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
                {counts.map((entry) => (
                  <li key={entry.label} className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="text-ink-500">{entry.label}</span>
                    <span className="tabular font-medium text-ink-900">{formatNumber(entry.value)}</span>
                  </li>
                ))}
              </ul>

              {canWrite && (
                <div className="mt-5 border-t border-ink-200 pt-4">
                  <Button variant="dangerOutline" size="sm" onClick={() => setConfirm(true)}>
                    <Trash2 />
                    Remove all demo data
                  </Button>
                  <p className="mt-2 text-[11.5px] text-ink-400">
                    Your dashboards will be empty afterwards until real activity accumulates. That is
                    the correct state for a new store.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Permanently delete ${formatNumber(total)} seeded records?`}
        description="Every record flagged as demo data is removed: products, orders, customers, analytics history, experiments and campaigns. Anything you created yourself is kept. This cannot be undone."
        confirmLabel="Delete demo data"
        destructive
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await purgeDemoDataAction();
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(result.message ?? "Demo data removed");
            setConfirm(false);
            router.refresh();
          })
        }
      />
    </>
  );
}
