"use client";

import * as React from "react";
import { toast } from "sonner";
import { subscribeAction } from "@/app/actions/storefront";
import { useStorefrontSession } from "@/components/storefront/analytics";
import { cn } from "@/lib/utils";

export function NewsletterForm({
  storeSlug,
  buttonLabel = "Subscribe",
  className,
}: {
  storeSlug: string;
  buttonLabel?: string;
  className?: string;
}) {
  const sessionId = useStorefrontSession();
  const [pending, startTransition] = React.useTransition();
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  if (done) {
    return (
      <p className="st-radius border px-4 py-3 text-[13.5px]" style={{ borderColor: "var(--st-border-strong)" }}>
        Thanks — you&apos;re on the list.
      </p>
    );
  }

  return (
    <form
      className={cn("flex flex-col gap-2 sm:flex-row", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await subscribeAction(storeSlug, formData, sessionId);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setDone(true);
          toast.success(result.message ?? "Subscribed");
        });
      }}
    >
      <label className="sr-only" htmlFor={id}>Email address</label>
      <input id={id} name="email" type="email" required placeholder="you@example.com" className="st-input flex-1" />
      <button type="submit" disabled={pending} className="st-btn disabled:opacity-60">
        {pending ? "Subscribing…" : buttonLabel}
      </button>
      {error && <p className="text-[12.5px]" style={{ color: "var(--st-sale)" }}>{error}</p>}
    </form>
  );
}
