"use client";

import * as React from "react";
import { motion, useReducedMotion, useInView } from "motion/react";

/**
 * Shared motion primitives for the marketing site. Every effect collapses to
 * static, fully-visible content under prefers-reduced-motion.
 */

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.6, 0.28, 0.99] }}
    >
      {children}
    </motion.div>
  );
}

/** Counts to a value when scrolled into view; renders the value directly when reduced. */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
  durationMs = 1200,
  className,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  durationMs?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [value, setValue] = React.useState(reduced ? to : 0);

  React.useEffect(() => {
    if (reduced || !inView) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(to * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, to, durationMs]);

  const shown = reduced || !inView ? (reduced ? to : value) : value;
  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {shown.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
