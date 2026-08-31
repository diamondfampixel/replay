import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatNumber } from "@/lib/money";
import type { MetricValue } from "@/lib/analytics-types";
import { Tooltip } from "@/components/ui/misc";

export function formatMetric(
  value: number,
  format: "money" | "number" | "percent",
  currency = "USD",
) {
  if (format === "money") return formatMoney(value, currency);
  if (format === "percent") return `${value.toFixed(2)}%`;
  return formatNumber(value);
}

export function DeltaBadge({
  change,
  invert = false,
  className,
}: {
  change: number | null;
  /** For metrics where down is good (refunds, cost). */
  invert?: boolean;
  className?: string;
}) {
  if (change === null) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-[12px] text-ink-400", className)}>
        <Minus className="size-3" />
        No baseline
      </span>
    );
  }
  const positive = invert ? change < 0 : change > 0;
  const neutral = Math.abs(change) < 0.05;
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 text-[12px] font-medium",
        neutral ? "text-ink-400" : positive ? "text-[var(--color-signal-positive)]" : "text-[var(--color-signal-negative)]",
        className,
      )}
    >
      {!neutral && <Icon className="size-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

export function MetricCard({
  label,
  metric,
  format = "number",
  currency = "USD",
  invert = false,
  hint,
  compact = false,
}: {
  label: string;
  metric: MetricValue;
  format?: "money" | "number" | "percent";
  currency?: string;
  invert?: boolean;
  hint?: string;
  compact?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "rounded-lg border border-ink-200 bg-white shadow-[0_1px_2px_rgba(16,16,14,0.04)]",
        compact ? "px-3 py-2.5" : "px-4 py-3.5",
      )}
    >
      <p className="text-[12px] font-medium text-ink-500">{label}</p>
      <p className={cn("tabular mt-1 font-semibold tracking-[-0.01em] text-ink-900", compact ? "text-[17px]" : "text-[22px]")}>
        {formatMetric(metric.value, format, currency)}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <DeltaBadge change={metric.change} invert={invert} />
        <span className="text-[11.5px] text-ink-400">
          vs {formatMetric(metric.previous, format, currency)}
        </span>
      </div>
    </div>
  );

  return hint ? <Tooltip content={hint}>{body}</Tooltip> : body;
}
