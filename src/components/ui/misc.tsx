"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-pine-600 data-[state=unchecked]:bg-ink-300 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

export function Checkbox({
  className,
  indeterminate,
  ...props
}: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { indeterminate?: boolean }) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "size-4 shrink-0 rounded-[4px] border border-ink-300 bg-white data-[state=checked]:border-ink-900 data-[state=checked]:bg-ink-900 disabled:opacity-50",
        indeterminate && "border-ink-900 bg-ink-900",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        {indeterminate ? <Minus className="size-3" /> : <Check className="size-3" />}
      </CheckboxPrimitive.Indicator>
      {indeterminate && (
        <span className="flex items-center justify-center text-white">
          <Minus className="size-3" />
        </span>
      )}
    </CheckboxPrimitive.Root>
  );
}

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex items-center gap-0.5 border-b border-ink-200 w-full", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink-800 data-[state=active]:border-ink-900 data-[state=active]:text-ink-900",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("pt-4 outline-none", className)} {...props} />;
}

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-64 rounded-md bg-ink-900 px-2 py-1 text-[12px] leading-snug text-white shadow-lg animate-in-soft"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-ink-200", className)} />;
}

export function Progress({ value, className, tone = "brand" }: { value: number; className?: string; tone?: "brand" | "neutral" }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-200", className)}>
      <div
        className={cn("h-full rounded-full transition-all", tone === "brand" ? "bg-pine-600" : "bg-ink-500")}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
