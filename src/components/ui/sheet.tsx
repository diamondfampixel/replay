"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

export function SheetContent({
  className,
  children,
  side = "right",
  width = "max-w-md",
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: "right" | "left";
  width?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-950/25" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-full flex-col border-ink-200 bg-white shadow-2xl",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          width,
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
