/** Shapes shared between analytics services and client components. */

export type MetricValue = {
  value: number;
  previous: number;
  /** Percentage change vs the previous period; null when there is no baseline. */
  change: number | null;
};

export type SeriesPoint = {
  date: string;
  revenue: number;
  orders: number;
  visitors: number;
  sessions: number;
  units: number;
  conversionRate: number;
};

export type FunnelStep = {
  label: string;
  value: number;
  rateFromPrevious: number | null;
  rateFromTop: number;
};
