import type { Prisma } from "@/generated/prisma/client";

export type Decimalish = Prisma.Decimal | number | string | null | undefined;

/** Prisma Decimal -> number. Money is stored as DECIMAL(10,2); JS numbers are
 *  exact for every value in that range, so this is safe for display + math. */
export function toNumber(value: Decimalish): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value) || 0;
  return Number(value.toString());
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(
  value: Decimalish,
  currency = "USD",
  opts: { compact?: boolean } = {},
): string {
  const amount = toNumber(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : 2,
    minimumFractionDigits: opts.compact ? 0 : 2,
  }).format(amount);
}

export function formatNumber(value: number, opts: { compact?: boolean } = {}) {
  return new Intl.NumberFormat("en-US", {
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : 0,
  }).format(value);
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

/** Percentage change from `previous` to `current`. Null when no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}
