"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/marketing-analytics";

/** Fires one page_view per marketing navigation. */
export function PageViewTracker() {
  const pathname = usePathname();
  const last = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    track("page_view");
  }, [pathname]);
  return null;
}

/** Fires an event the first time its children scroll into view. */
export function TrackView({
  event,
  children,
  className,
}: {
  event: "demo_viewed" | "pricing_viewed";
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const sent = React.useRef(false);
  React.useEffect(() => {
    const node = ref.current;
    if (!node || sent.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !sent.current) {
          sent.current = true;
          track(event, { once: true });
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [event]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function TrackedLink({
  href,
  event,
  children,
  className,
}: {
  href: string;
  event: "login_click" | "hero_cta";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a href={href} onClick={() => track(event)} className={className}>
      {children}
    </a>
  );
}
