"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function UndoActionButton({ actionId }: { actionId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          const response = await fetch("/api/ai/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actionId, decision: "undo" }),
          });
          const data = await response.json();
          if (!response.ok) {
            toast.error(data.error ?? "Could not undo that action");
            return;
          }
          toast.success(data.summary ?? "Reverted");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      <RotateCcw />
      Undo this action
    </Button>
  );
}
