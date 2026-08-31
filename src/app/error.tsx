"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <h1 className="text-[20px] font-semibold text-ink-900">Something went wrong</h1>
      <p className="mt-1.5 max-w-md text-[14px] text-ink-500">
        The page failed to load. Nothing was changed. Try again, and if it keeps happening the
        details below will help track it down.
      </p>
      {error.digest && (
        <code className="mt-3 rounded bg-ink-100 px-2 py-1 text-[12px] text-ink-600">
          Error reference: {error.digest}
        </code>
      )}
      <div className="mt-6 flex gap-2">
        <Button variant="primary" onClick={reset}>Try again</Button>
        <Button asChild variant="secondary">
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
