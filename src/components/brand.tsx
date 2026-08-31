import { cn } from "@/lib/utils";

/** Halyard mark — a cleat hitch abstracted into three stacked strokes. */
export function Logomark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-6", className)} aria-hidden="true">
      <rect width="24" height="24" rx="6" className="fill-ink-900" />
      <path
        d="M7 8.5h10M7 12h6M7 15.5h10"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="16.5" cy="12" r="1.6" className="fill-pine-400" />
    </svg>
  );
}

export function Wordmark({ className, showMark = true }: { className?: string; showMark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {showMark && <Logomark />}
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink-900">Halyard</span>
    </span>
  );
}
