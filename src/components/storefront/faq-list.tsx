"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FaqList({ items }: { items: Array<{ q: string; a: string }> }) {
  const [open, setOpen] = React.useState<number | null>(0);

  if (!items.length) {
    return (
      <p className="rounded-md border border-dashed border-ink-300 px-4 py-8 text-center text-[13px] text-ink-500">
        No questions added yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-current/12 border-y border-current/12">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <li key={index}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : index)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-3 py-4 text-left"
            >
              <span className="text-[14.5px] font-medium">{item.q}</span>
              <ChevronDown className={cn("size-4 shrink-0 opacity-50 transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded && (
              <p className="pb-4 text-[13.5px] leading-relaxed opacity-75">{item.a}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
