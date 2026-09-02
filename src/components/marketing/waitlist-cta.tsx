"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { attributionForWaitlist, track } from "@/lib/marketing-analytics";

/**
 * The one control on the page. A single pill that becomes the email field
 * when tapped, then the confirmation. Same real backend as before: entries
 * persist with first-touch attribution, duplicates get the same calm success,
 * the API rate-limits.
 */
type State = "idle" | "open" | "sending" | "done";

export function WaitlistCta({ label = "Join the waitlist" }: { label?: string }) {
  const reduced = useReducedMotion();
  const [state, setState] = React.useState<State>("idle");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (state === "open") inputRef.current?.focus();
  }, [state]);

  function open() {
    track("hero_cta", { once: true });
    track("waitlist_started", { once: true });
    setState("open");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "sending") return;
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address.");
      inputRef.current?.focus();
      return;
    }
    setState("sending");
    setError(null);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value, ...attributionForWaitlist() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState("open");
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setState("done");
      track("waitlist_submitted");
    } catch {
      setState("open");
      setError("Something went wrong. Try again.");
    }
  }

  const spring = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 320, damping: 30 };
  const fade = reduced ? { duration: 0 } : { duration: 0.22 };

  return (
    <div className="wl-cta">
      <motion.div layout transition={spring} className="wl-pill" data-state={state}>
        <AnimatePresence mode="wait" initial={false}>
          {state === "idle" && (
            <motion.button
              key="idle"
              type="button"
              onClick={open}
              className="wl-pill-button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
            >
              {label}
            </motion.button>
          )}

          {(state === "open" || state === "sending") && (
            <motion.form
              key="form"
              onSubmit={submit}
              className="wl-pill-form"
              noValidate
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
            >
              <label htmlFor="wl-email" className="sr-only">Email address</label>
              <input
                id="wl-email"
                ref={inputRef}
                type="email"
                name="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                enterKeyHint="go"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "wl-error" : undefined}
                disabled={state === "sending"}
                className="wl-pill-input"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                aria-label={state === "sending" ? "Joining" : "Join"}
                className="wl-pill-submit"
              >
                {state === "sending" ? <span className="wl-spinner" /> : <ArrowRight className="size-[18px]" />}
              </button>
            </motion.form>
          )}

          {state === "done" && (
            <motion.div
              key="done"
              role="status"
              className="wl-pill-done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={fade}
            >
              <span className="wl-done-check"><Check className="size-3.5" strokeWidth={3} /></span>
              <span>
                <span className="block font-medium">You&apos;re on the list.</span>
                <span className="block text-[12.5px] opacity-75">We&apos;ll email you when your spot opens.</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="wl-error-slot" aria-live="polite">
        {error && state !== "done" && (
          <p id="wl-error" className="wl-error">{error}</p>
        )}
      </div>
    </div>
  );
}
