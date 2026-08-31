import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 pb-4", className)}>
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1.5 text-[12px] text-ink-500">{breadcrumb}</div>}
        <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h2 className="text-[14px] font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-[12.5px] text-ink-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
