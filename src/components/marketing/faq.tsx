"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { track } from "@/lib/marketing-analytics";

export function FaqList({ items }: { items: Array<{ q: string; a: string }> }) {
  const tracked = React.useRef(false);
  return (
    <div className="divide-y divide-night-line border-y border-night-line">
      {items.map((item) => (
        <details
          key={item.q}
          className="group py-4"
          onToggle={(event) => {
            if ((event.target as HTMLDetailsElement).open && !tracked.current) {
              tracked.current = true;
              track("faq_opened", { once: true });
            }
          }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-night-text [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown className="size-4 shrink-0 text-night-faint transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-night-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
