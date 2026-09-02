"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[color,background-color,border-color,transform] active:scale-[0.985] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
        brand:
          "bg-pine-600 text-white hover:bg-pine-700 active:bg-pine-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
        secondary:
          "bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 active:bg-ink-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        ghost: "text-ink-700 hover:bg-ink-100 active:bg-ink-200",
        danger:
          "bg-[var(--color-signal-negative)] text-white hover:brightness-110 active:brightness-95",
        dangerOutline:
          "bg-white text-[var(--color-signal-negative)] border border-[color-mix(in_srgb,var(--color-signal-negative)_35%,white)] hover:bg-[color-mix(in_srgb,var(--color-signal-negative)_6%,white)]",
        link: "text-pine-700 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-7 px-2.5 text-[13px] [&_svg]:size-3.5",
        md: "h-9 px-3.5 text-sm [&_svg]:size-4",
        lg: "h-11 px-5 text-[15px] [&_svg]:size-4",
        icon: "h-9 w-9 [&_svg]:size-4",
        iconSm: "h-7 w-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
