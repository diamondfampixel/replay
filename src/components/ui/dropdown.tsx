"use client";

import * as React from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;

export function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-44 overflow-hidden rounded-md border border-ink-200 bg-white p-1 shadow-lg animate-in-soft",
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: React.ComponentPropsWithoutRef<typeof DM.Item> & { destructive?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-[13px] text-ink-700 outline-none data-[highlighted]:bg-ink-100 data-[disabled]:opacity-50 [&_svg]:size-3.5 [&_svg]:text-ink-500",
        destructive &&
          "text-[var(--color-signal-negative)] [&_svg]:text-[var(--color-signal-negative)] data-[highlighted]:bg-[#fdeeeb]",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Label>) {
  return <DM.Label className={cn("px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Separator>) {
  return <DM.Separator className={cn("my-1 h-px bg-ink-200", className)} {...props} />;
}
