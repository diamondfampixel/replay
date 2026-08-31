"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm";
import { setStoreStatusAction } from "@/app/actions/store";
import type { StoreStatus } from "@/generated/prisma/client";

export function StoreStatusControl({ status }: { status: StoreStatus }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [target, setTarget] = React.useState<StoreStatus | null>(null);

  async function apply(next: StoreStatus) {
    setPending(true);
    try {
      const result = await setStoreStatusAction(next as "DRAFT" | "ACTIVE" | "PAUSED");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Updated");
      setTarget(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {status === "ACTIVE" ? (
        <Button size="sm" variant="secondary" className="w-full" onClick={() => setTarget("PAUSED")}>
          Pause store
        </Button>
      ) : (
        <Button size="sm" variant="brand" className="w-full" onClick={() => setTarget("ACTIVE")}>
          Take store live
        </Button>
      )}

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
        title={target === "ACTIVE" ? "Take your store live?" : "Pause your store?"}
        description={
          target === "ACTIVE"
            ? "Anyone with the link will be able to browse and buy. Orders placed will be real records in this store."
            : "Shoppers will get a 404 until you take it live again. Existing orders and data are untouched."
        }
        confirmLabel={target === "ACTIVE" ? "Go live" : "Pause store"}
        destructive={target === "PAUSED"}
        loading={pending}
        onConfirm={() => target && apply(target)}
      />
    </>
  );
}
