import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {Icon && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-ink-200 bg-ink-50">
          <Icon className="size-4 text-ink-400" />
        </div>
      )}
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-500">{description}</p>}
      {action &&
        (action.href ? (
          <Button asChild size="sm" variant="secondary" className="mt-4">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button size="sm" variant="secondary" className="mt-4" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-ink-200">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-3 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-1/3" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  retry,
}: {
  title?: string;
  description?: string;
  retry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-md text-[13px] text-ink-500">{description}</p>}
      {retry && (
        <Button size="sm" variant="secondary" className="mt-4" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Marks values that come from seeded demo data rather than real activity. */
export function DemoTag({ className, label = "Demo data" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500",
        className,
      )}
      title="Seeded demo data — not real business performance"
    >
      {label}
    </span>
  );
}
