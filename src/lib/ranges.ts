/**
 * Date-range resolution shared by dashboards, exports and the AI analytics
 * tools. Kept free of server-only imports so client components (the range
 * picker) can read the presets.
 */

export const RANGE_PRESETS = {
  today: { label: "Today", days: 1 },
  yesterday: { label: "Yesterday", days: 1 },
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  "12m": { label: "Last 12 months", days: 365 },
} as const;

export type RangeKey = keyof typeof RANGE_PRESETS | "custom";

export type DateRange = {
  key: RangeKey;
  label: string;
  from: Date;
  to: Date;
  /** Equivalent window immediately before `from`, for period-over-period. */
  previousFrom: Date;
  previousTo: Date;
  days: number;
};

export function utcMidnight(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function resolveRange(key: string | undefined, from?: string, to?: string): DateRange {
  const today = utcMidnight(new Date());

  if (key === "custom" && from && to) {
    const start = utcMidnight(new Date(from));
    const end = utcMidnight(new Date(to));
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 864e5) + 1);
    return {
      key: "custom",
      label: `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`,
      from: start,
      to: addDays(end, 1),
      previousFrom: addDays(start, -days),
      previousTo: start,
      days,
    };
  }

  const presetKey = (key && key in RANGE_PRESETS ? key : "30d") as keyof typeof RANGE_PRESETS;
  const preset = RANGE_PRESETS[presetKey];

  if (presetKey === "yesterday") {
    const start = addDays(today, -1);
    return {
      key: presetKey, label: preset.label, from: start, to: today,
      previousFrom: addDays(today, -2), previousTo: start, days: 1,
    };
  }

  const start = presetKey === "today" ? today : addDays(today, -(preset.days - 1));
  const end = addDays(today, 1);
  return {
    key: presetKey,
    label: preset.label,
    from: start,
    to: end,
    previousFrom: addDays(start, -preset.days),
    previousTo: start,
    days: preset.days,
  };
}
