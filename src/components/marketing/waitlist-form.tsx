"use client";

import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import { attributionForWaitlist, track } from "@/lib/marketing-analytics";
import { cn } from "@/lib/utils";

/**
 * The real waitlist form. Entries land in the database with first-touch
 * attribution; duplicates get the same calm success as first-timers.
 */
export function WaitlistForm({
  size = "lg",
  ctaLabel = "Join the waitlist",
}: {
  size?: "lg" | "md";
  ctaLabel?: string;
}) {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setMessage(null);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, ...attributionForWaitlist() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState("error");
        setMessage(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setState("done");
      track("waitlist_submitted");
    } catch {
      setState("error");
      setMessage("Something went wrong. Try again.");
    }
  }

  if (state === "done") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-glow-green/30 bg-glow-green/10 text-night-text",
          size === "lg" ? "px-5 py-4" : "px-4 py-3",
        )}
        role="status"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-glow-green/20">
          <Check className="size-4 text-glow-green" />
        </span>
        <div>
          <p className={cn("font-medium", size === "lg" ? "text-[15px]" : "text-[14px]")}>
            You&apos;re on the list.
          </p>
          <p className="text-[12.5px] text-night-muted">
            We&apos;ll email you when your spot opens. No noise before that.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full" noValidate>
      <div
        className={cn(
          "flex w-full flex-col gap-2 sm:flex-row",
          size === "lg" ? "max-w-md" : "max-w-sm",
        )}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onFocus={() => track("waitlist_started", { once: true })}
          placeholder="you@example.com"
          aria-label="Email address"
          autoComplete="email"
          inputMode="email"
          className={cn(
            "w-full flex-1 rounded-lg border border-night-line-strong bg-night-800/80 text-night-text placeholder:text-night-faint",
            "outline-none backdrop-blur transition-colors focus:border-glow-green/60",
            size === "lg" ? "px-4 py-3 text-[15px]" : "px-3.5 py-2.5 text-[14px]",
          )}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className={cn(
            "group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-night-text font-medium text-night-950",
            "transition-[transform,background-color] hover:bg-white active:scale-[0.98] disabled:opacity-60",
            size === "lg" ? "px-5 py-3 text-[14.5px]" : "px-4 py-2.5 text-[13.5px]",
          )}
        >
          {state === "sending" ? "Joining…" : ctaLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
      {state === "error" && message && (
        <p className="mt-2 text-[12.5px] text-[#e2857a]" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
