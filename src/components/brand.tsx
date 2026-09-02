import { cn } from "@/lib/utils";

/**
 * The Halyard mark: an H whose crossbar is the halyard — the line that raises
 * the sail — pulled up from the left post toward the top of the right. It is
 * still unmistakably an H at 16px; the rise is what makes it ours.
 *
 * One geometry everywhere: favicon, app icon, dashboard, marketing, loading.
 */
export const MARK_PATH = "M6 4v16M18 4v16M6 15.2 18 8.8";

export function LogomarkGlyph({
  color = "currentColor",
  strokeWidth = 2.7,
}: {
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <path
      d={MARK_PATH}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

/** Mark on its rounded tile — the app-icon form. */
export function Logomark({
  className,
  tone = "light",
}: {
  className?: string;
  /** light: dark tile, light glyph (default). dark-ground: pale tile, dark glyph. */
  tone?: "light" | "dark-ground";
}) {
  const tile = tone === "light" ? "#111318" : "#e8ebef";
  const glyph = tone === "light" ? "#ffffff" : "#0b0e13";
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill={tile} />
      <LogomarkGlyph color={glyph} />
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

/** Dark-ground variant for the marketing night world. */
export function WordmarkNight({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logomark tone="dark-ground" />
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-night-text">Halyard</span>
    </span>
  );
}
