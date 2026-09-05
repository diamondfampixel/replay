"use client";

import { useEffect, useState } from "react";

/**
 * Live countdown to a drop. Renders the same digits on the server and the
 * first client paint (computed from the target, not from "now") so hydration
 * never mismatches; then ticks once a second. Past dates read "Live now".
 */
export function Countdown({ endsAt, className }: { endsAt: string; className?: string }) {
  const target = Date.parse(endsAt);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!Number.isFinite(target)) {
    return <p className={className}>Date to be announced</p>;
  }
  const remaining = Math.max(0, target - (now ?? target));
  if (now !== null && remaining === 0) {
    return <p className={className} role="status">Live now</p>;
  }
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const cells: Array<[string, string]> = [[String(days), days === 1 ? "day" : "days"], [pad(hours), "hrs"], [pad(minutes), "min"], [pad(seconds), "sec"]];

  return (
    <div className={className} role="timer" aria-live="off" aria-label={`${days} days ${hours} hours ${minutes} minutes`}>
      <div className="flex flex-wrap items-end gap-4 sm:gap-6">
        {cells.map(([value, label]) => (
          <div key={label} className="min-w-[3.2ch]">
            <span className="st-heading-font block text-[clamp(28px,6vw,64px)] font-semibold leading-none tabular-nums" suppressHydrationWarning>{value}</span>
            <span className="st-eyebrow mt-1 block opacity-70">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
