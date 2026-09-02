"use client";

import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { RevenueChartDemo, StorefrontMiniDemo, OrderToastDemo } from "@/components/marketing/demo-cards";

/**
 * Lightweight previews of the two alternate hero directions, kept only for
 * the design decision (routed under /dev/hero-concepts, never linked). The
 * production hero is Concept A in hero.tsx.
 */

export function HeroConceptB() {
  const reduced = useReducedMotion();
  const [state, setState] = React.useState<"before" | "after">("before");

  React.useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setState((s) => (s === "before" ? "after" : "before")), 3600);
    return () => clearInterval(timer);
  }, [reduced]);

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-night-950 px-5">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 40% at 50% 20%, rgba(61,189,139,0.06), transparent 70%)" }} />
      <p className="font-mono text-[12px] uppercase tracking-[0.28em] text-glow-green">Halyard</p>
      <h1 className="mt-4 text-center font-display text-[42px] font-semibold leading-tight tracking-[-0.03em] text-night-text sm:text-[56px]">
        Tell your store what to do.
      </h1>

      {/* The command that drives the transformation */}
      <div className="mt-8 w-full max-w-md rounded-lg border border-night-line-strong bg-night-800/90 px-4 py-3 font-mono text-[13px] text-night-text backdrop-blur">
        <span className="text-glow-green">→ </span>
        {state === "before" ? "run a 15% weekend sale on hoodies" : "done — 27 prices updated, banner live"}
      </div>

      <div className="relative mt-8 w-full max-w-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.45 }}
          >
            <div className="relative">
              <StorefrontMiniDemo />
              {state === "after" && (
                <span className="absolute right-3 top-11 rounded bg-pine-600 px-1.5 py-0.5 text-[8.5px] font-semibold text-white">
                  WEEKEND SALE −15%
                </span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-10 w-full max-w-md"><WaitlistForm size="md" /></div>
    </section>
  );
}

export function HeroConceptC() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-night-950 px-5">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(50% 34% at 50% 12%, rgba(226,232,240,0.05), transparent 70%)" }} />
      <h1 className="text-center font-display text-[46px] font-semibold leading-[1.04] tracking-[-0.03em] text-night-text sm:text-[60px]">
        Build your store.
        <br />
        Run it with AI.
      </h1>
      <p className="mt-4 max-w-md text-center text-[15px] text-night-muted">
        A new kind of commerce platform is coming.
      </p>
      <div className="mt-8 w-full max-w-md"><WaitlistForm /></div>

      <div className="mt-14 w-full max-w-2xl" style={{ perspective: "1400px" }}>
        <div
          className="mx-auto grid max-w-xl grid-cols-2 gap-3"
          style={{ transform: "rotateX(14deg) rotateZ(-2deg)", transformStyle: "preserve-3d" }}
        >
          <RevenueChartDemo />
          <div className="space-y-3">
            <OrderToastDemo />
            <StorefrontMiniDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
