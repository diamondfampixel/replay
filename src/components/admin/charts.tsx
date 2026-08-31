"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatMoney, formatNumber } from "@/lib/money";

const AXIS = { stroke: "#a5a59d", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = { stroke: "#e5e5e1", strokeDasharray: "3 3", vertical: false } as const;

export const CHART_COLORS = [
  "var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)",
  "var(--color-chart-4)", "var(--color-chart-5)", "var(--color-chart-6)",
];

function formatDateTick(value: string, span: number) {
  const date = new Date(`${value}T00:00:00Z`);
  if (span > 120) return date.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

type Formatter = "money" | "number" | "percent";

function formatValue(value: number, format: Formatter, currency: string) {
  if (format === "money") return formatMoney(value, currency);
  if (format === "percent") return `${value.toFixed(2)}%`;
  return formatNumber(value);
}

function ChartTooltip({
  active, payload, label, format, currency,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
  format: Formatter;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-ink-200 bg-white px-2.5 py-2 shadow-lg">
      {label && (
        <p className="mb-1 text-[11px] font-medium text-ink-500">
          {new Date(`${label}T00:00:00Z`).toLocaleDateString(undefined, {
            weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
          })}
        </p>
      )}
      {payload.map((entry, index) => (
        <p key={index} className="tabular flex items-center gap-2 text-[12.5px] text-ink-800">
          <span className="size-2 rounded-sm" style={{ background: entry.color }} />
          <span className="text-ink-500">{entry.name}</span>
          <span className="ml-auto font-medium">
            {formatValue(entry.value ?? 0, format, currency)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function TrendChart({
  data,
  dataKey,
  name,
  format = "number",
  currency = "USD",
  color = "var(--color-chart-1)",
  height = 240,
  variant = "area",
}: {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  name: string;
  format?: Formatter;
  currency?: string;
  color?: string;
  height?: number;
  variant?: "area" | "line" | "bar";
}) {
  const span = data.length;
  const gradientId = `grad-${dataKey}`;

  const axes = (
    <>
      <CartesianGrid {...GRID} />
      <XAxis
        dataKey="date"
        {...AXIS}
        tickFormatter={(value: string) => formatDateTick(value, span)}
        minTickGap={24}
      />
      <YAxis
        {...AXIS}
        width={52}
        tickFormatter={(value: number) =>
          format === "money"
            ? formatMoney(value, currency, { compact: true })
            : format === "percent"
              ? `${value}%`
              : formatNumber(value, { compact: true })
        }
      />
      <Tooltip
        content={<ChartTooltip format={format} currency={currency} />}
        cursor={{ stroke: "#d3d3ce", strokeWidth: 1 }}
      />
    </>
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      {variant === "bar" ? (
        <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          {axes}
          <Bar dataKey={dataKey} name={name} fill={color} radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      ) : variant === "line" ? (
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          {axes}
          <Line dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      ) : (
        <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {axes}
          <Area
            dataKey={dataKey}
            name={name}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}

export function Sparkline({
  data,
  dataKey,
  color = "var(--color-chart-1)",
}: {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <Line dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 200,
}: {
  data: Array<{ name: string; value: number }>;
  height?: number;
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
            {data.map((_, index) => (
              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip format="number" currency="USD" />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-1.5">
        {data.map((entry, index) => (
          <li key={entry.name} className="flex items-center gap-2 text-[12.5px]">
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="capitalize text-ink-600">{entry.name}</span>
            <span className="tabular ml-auto font-medium text-ink-800">
              {total ? `${((entry.value / total) * 100).toFixed(1)}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HorizontalBars({
  data,
  format = "number",
  currency = "USD",
}: {
  data: Array<{ label: string; value: number }>;
  format?: Formatter;
  currency?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2.5">
      {data.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-[12.5px] capitalize text-ink-700">{row.label}</span>
            <span className="tabular shrink-0 text-[12.5px] font-medium text-ink-900">
              {formatValue(row.value, format, currency)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-pine-600"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
