"use client";

import * as React from "react";
import { toast } from "sonner";
import { subscribeAction } from "@/app/actions/storefront";
import { useStorefrontSession } from "@/components/storefront/analytics";

export function NewsletterForm({
  storeSlug,
  buttonLabel = "Subscribe",
}: {
  storeSlug: string;
  buttonLabel?: string;
}) {
  const sessionId = useStorefrontSession();
  const [pending, startTransition] = React.useTransition();
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (done) {
    return (
      <p className="rounded-md border border-current/20 px-4 py-3 text-[13.5px]">
        Thanks — you&apos;re on the list.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
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
      <label className="sr-only" htmlFor="newsletter-email">Email address</label>
      <input
        id="newsletter-email"
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="h-11 flex-1 rounded-md border border-current/25 bg-white/95 px-3 text-[14px] text-ink-900 outline-none placeholder:text-ink-400"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-md bg-ink-900 px-5 text-[14px] font-medium text-white transition-colors hover:bg-ink-800 disabled:opacity-60"
      >
        {pending ? "Subscribing…" : buttonLabel}
      </button>
      {error && <p className="text-[12.5px] text-[var(--color-signal-negative)] sm:absolute sm:mt-12">{error}</p>}
    </form>
  );
}
