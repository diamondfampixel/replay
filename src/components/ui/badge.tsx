import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-ink-100 text-ink-700 border-ink-200",
        success: "bg-pine-50 text-pine-800 border-pine-200",
        warning: "bg-[#fdf6e7] text-[#7a4e07] border-[#f0dfb8]",
        danger: "bg-[#fdeeeb] text-[#8c2817] border-[#f5cec6]",
        info: "bg-[#eef3fa] text-[#234c7d] border-[#cfdcee]",
        outline: "bg-white text-ink-600 border-ink-300",
        solid: "bg-ink-900 text-white border-ink-900",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Dot({ tone = "neutral" }: { tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const colors: Record<string, string> = {
    neutral: "bg-ink-400",
    success: "bg-pine-600",
    warning: "bg-[#c98a10]",
    danger: "bg-[#b4331f]",
    info: "bg-[#2b5f9e]",
  };
  return <span className={cn("inline-block size-1.5 rounded-full", colors[tone])} />;
}
