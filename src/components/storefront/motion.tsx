"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";

/**
 * Scroll reveal. Marks the storefront root as `st-js` (so the CSS knows it can
 * hide elements safely) and flips `is-in` on every `[data-reveal]` element as
 * it enters the viewport. Respects reduced motion by doing nothing.
 */
export function RevealObserver() {
  React.useEffect(() => {
    const root = document.querySelector<HTMLElement>(".st-root");
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || root.dataset.motion === "off" || !("IntersectionObserver" in window)) return;

    root.classList.add("st-js");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const observe = () => {
      root.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)").forEach((el) => {
        // Anything already on screen at load shows immediately (no pop-in).
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.9) el.classList.add("is-in");
        else observer.observe(el);
      });
    };
    observe();
    const mo = new MutationObserver(observe);
    mo.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); mo.disconnect(); root.classList.remove("st-js"); };
  }, []);
  return null;
}

/**
 * Lightweight parallax: translates its child a fraction of the scroll delta.
 * Only active when the store's motion config allows it, on pointer devices
 * wider than a phone, and never under reduced motion.
 */
export function Parallax({ children, strength = 0.18, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 768) return;
    if (el.closest('[data-motion="off"]')) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const centre = rect.top + rect.height / 2 - window.innerHeight / 2;
      el.style.transform = `translate3d(0, ${Math.round(-centre * strength)}px, 0) scale(1.12)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [strength]);
  return <div ref={ref} className={className}>{children}</div>;
}

/**
 * Muted, looping background video with a real pause control (WCAG 2.2.2).
 * The CSS hides the video under reduced motion or when motion is off, so the
 * poster carries the section there — no JS decides that.
 */
export function VideoBackground({ src, poster }: { src: string; poster?: string | null }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = React.useState(false);
  return (
    <>
      <video ref={ref} className="st-video" src={src} poster={poster ?? undefined} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
      <button
        type="button"
        onClick={() => {
          const v = ref.current;
          if (!v) return;
          if (v.paused) { v.play().catch(() => undefined); setPaused(false); } else { v.pause(); setPaused(true); }
        }}
        className="absolute bottom-4 right-4 z-10 inline-flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65"
        aria-label={paused ? "Play background video" : "Pause background video"}
      >
        {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
      </button>
    </>
  );
}
