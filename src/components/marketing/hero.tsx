"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import {
  ABTestDemo, AssistantDemo, OrderToastDemo, ProductCardDemo,
  RevenueChartDemo, StorefrontMiniDemo,
} from "@/components/marketing/demo-cards";
import { track } from "@/lib/marketing-analytics";
import { cn } from "@/lib/utils";

/**
 * Concept A — "the operating system assembles a business around you."
 *
 * Real Halyard surfaces (marketing-safe replicas on the same design system)
 * hang at different depths in a dark room. They enter in the order a business
 * comes to life — storefront, product, revenue, assistant — and then the room
 * stays quietly alive: orders arrive, the assistant acts. Pointer movement
 * shifts the layers a few pixels for depth on desktop; mobile gets slow
 * autonomous drift instead. Everything is DOM + transforms — no WebGL — and
 * prefers-reduced-motion renders the whole scene static and fully visible.
 */

const ORDERS = [
  { number: 4581, total: "$86.30" },
  { number: 4582, total: "$132.00" },
  { number: 4583, total: "$54.15" },
  { number: 4584, total: "$208.40" },
];

function useParallax(strength: number) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 42, damping: 16, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 42, damping: 16, mass: 0.6 });

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const relX = (event.clientX - bounds.left) / bounds.width - 0.5;
      const relY = (event.clientY - bounds.top) / bounds.height - 0.5;
      x.set(relX * strength);
      y.set(relY * strength);
    },
    [x, y, strength],
  );

  const reset = React.useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return { springX, springY, onPointerMove, reset };
}

function FloatingCard({
  depth,
  parallax,
  entrance,
  float,
  className,
  children,
}: {
  /** 0..1 — how strongly this layer follows the pointer. */
  depth: number;
  parallax: { springX: ReturnType<typeof useSpring>; springY: ReturnType<typeof useSpring> };
  entrance: number;
  /** Idle drift phase, so the cards never move in lockstep. */
  float: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const x = React.useMemo(
    () => (reduced ? undefined : parallax.springX),
    [reduced, parallax.springX],
  );
  const y = React.useMemo(
    () => (reduced ? undefined : parallax.springY),
    [reduced, parallax.springY],
  );

  return (
    <motion.div
      className={cn("absolute", className)}
      style={
        reduced
          ? undefined
          : ({ x, y, scale: 1, ["--depth" as string]: depth } as React.CSSProperties)
      }
      initial={reduced ? false : { opacity: 0, y: 28, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.9, delay: reduced ? 0 : entrance, ease: [0.21, 0.6, 0.28, 0.99] }}
    >
      <div
        className={reduced ? undefined : "hero-float"}
        style={reduced ? undefined : { animationDelay: `${float}s`, animationDuration: `${9 + float * 2}s` }}
      >
        {children}
      </div>
    </motion.div>
  );
}

export function Hero({ cta }: { cta: { label: string; kind: "waitlist" | "signup" } }) {
  const reduced = useReducedMotion();
  const parallaxNear = useParallax(14);
  const parallaxMid = useParallax(8);
  const parallaxFar = useParallax(4);
  const [orderIndex, setOrderIndex] = React.useState(0);

  React.useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => {
      setOrderIndex((index) => (index + 1) % ORDERS.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [reduced]);

  const order = ORDERS[orderIndex];

  function onMove(event: React.PointerEvent) {
    if (reduced || event.pointerType !== "mouse") return;
    parallaxNear.onPointerMove(event);
    parallaxMid.onPointerMove(event);
    parallaxFar.onPointerMove(event);
  }

  function onLeave() {
    parallaxNear.reset();
    parallaxMid.reset();
    parallaxFar.reset();
  }

  return (
    <section
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative isolate min-h-[100svh] overflow-hidden bg-night-950"
      aria-label="Halyard — build your store, run it with AI"
    >
      {/* Atmosphere: two faint pools of light, then a vignette. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(52% 44% at 78% 30%, rgba(61,189,139,0.075), transparent 68%)," +
            "radial-gradient(46% 40% at 12% 82%, rgba(84,110,160,0.09), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(4,6,10,0.7) 100%)" }}
      />

      <div className="relative mx-auto grid min-h-[100svh] w-full max-w-6xl grid-rows-[1fr_auto] px-5 pt-24 sm:pt-0 lg:grid-rows-1">
        {/* Copy + conversion */}
        <div className="z-10 flex max-w-xl flex-col justify-center pb-10 sm:pb-0">
          <motion.p
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="font-mono text-[12px] font-medium uppercase tracking-[0.28em] text-glow-green"
          >
            Halyard
          </motion.p>
          <motion.h1
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: reduced ? 0 : 0.1, ease: [0.21, 0.6, 0.28, 0.99] }}
            className="mt-4 font-display text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] text-night-text sm:text-[64px]"
            style={{ textWrap: "balance" }}
          >
            Build your store.
            <br />
            Run it with AI.
          </motion.h1>
          <motion.p
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: reduced ? 0 : 0.24 }}
            className="mt-5 max-w-md text-[16px] leading-relaxed text-night-muted"
          >
            One operating system for products, orders, analytics, and growth —
            with an assistant that does the work, and asks before anything big.
          </motion.p>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: reduced ? 0 : 0.36 }}
            className="mt-8"
          >
            {cta.kind === "waitlist" ? (
              <WaitlistForm ctaLabel={cta.label} />
            ) : (
              <Link
                href="/signup"
                onClick={() => track("hero_cta")}
                className="inline-flex items-center gap-2 rounded-lg bg-night-text px-6 py-3 text-[15px] font-medium text-night-950 transition-transform hover:bg-white active:scale-[0.98]"
              >
                {cta.label}
              </Link>
            )}
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-night-faint">
              Build · Launch · Sell · Grow
            </p>
          </motion.div>
        </div>

        {/* The assembling business — desktop composition */}
        <div className="pointer-events-none absolute inset-y-0 right-[-40px] hidden w-[560px] lg:block" aria-hidden>
          <FloatingCard depth={0.3} parallax={parallaxFar} entrance={0.35} float={0} className="right-56 top-[16%] w-64 opacity-80">
            <StorefrontMiniDemo />
          </FloatingCard>
          <FloatingCard depth={0.55} parallax={parallaxMid} entrance={0.55} float={1.3} className="right-6 top-[8%] w-60">
            <ProductCardDemo />
          </FloatingCard>
          <FloatingCard depth={0.55} parallax={parallaxMid} entrance={0.75} float={2.1} className="right-72 top-[52%] w-60">
            <RevenueChartDemo />
          </FloatingCard>
          <FloatingCard depth={0.85} parallax={parallaxNear} entrance={0.95} float={0.7} className="right-2 top-[38%] w-72">
            <AssistantDemo
              command="Drop hoodie prices 15% for the weekend"
              toolName="adjust_prices"
              toolSummary="27 products · needs your OK"
              reply="Done — sale prices are live. Want a homepage banner to match?"
            />
          </FloatingCard>
          <FloatingCard depth={0.4} parallax={parallaxFar} entrance={1.15} float={3.2} className="right-64 bottom-[6%] w-56 opacity-90">
            <ABTestDemo />
          </FloatingCard>
          <FloatingCard depth={1} parallax={parallaxNear} entrance={1.5} float={0} className="right-10 bottom-[12%]">
            <motion.div
              key={order.number}
              initial={reduced ? false : { opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.21, 0.6, 0.28, 0.99] }}
            >
              <OrderToastDemo number={order.number} total={order.total} />
            </motion.div>
          </FloatingCard>
        </div>

        {/* Mobile composition: a compact, quietly drifting collage below the copy */}
        <div className="relative z-0 -mx-1 mb-12 h-64 lg:hidden" aria-hidden>
          <FloatingCard depth={0.4} parallax={parallaxFar} entrance={0.4} float={0.5} className="left-0 top-2 w-52">
            <AssistantDemo
              command="Run a weekend sale"
              toolName="adjust_prices"
              toolSummary="27 products"
              reply="Done — sale is live."
            />
          </FloatingCard>
          <FloatingCard depth={0.6} parallax={parallaxMid} entrance={0.65} float={1.7} className="right-0 top-8 w-44">
            <RevenueChartDemo />
          </FloatingCard>
          <FloatingCard depth={1} parallax={parallaxNear} entrance={1.1} float={0} className="bottom-2 right-6">
            <motion.div
              key={order.number}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <OrderToastDemo number={order.number} total={order.total} />
            </motion.div>
          </FloatingCard>
        </div>
      </div>
    </section>
  );
}
