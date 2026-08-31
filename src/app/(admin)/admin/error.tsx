"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] unhandled error", error);
  }, [error]);

  const isAuthorization = /role does not allow|not permitted/i.test(error.message);

  return (
    <div className="mx-auto max-w-xl py-16">
      <Card>
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full border border-ink-200 bg-ink-50">
            <AlertTriangle className="size-4 text-[var(--color-signal-warning)]" />
          </div>
          <h1 className="text-[17px] font-semibold text-ink-900">
            {isAuthorization ? "You do not have access to this" : "This section failed to load"}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-500">
            {isAuthorization
              ? "Your role does not include the permission this page needs. Ask an owner or admin if you should have it."
              : "Nothing was changed. Try again, or head back to the dashboard."}
          </p>
          {error.digest && (
            <code className="mt-3 inline-block rounded bg-ink-100 px-2 py-1 text-[11.5px] text-ink-500">
              {error.digest}
            </code>
          )}
          <div className="mt-5 flex justify-center gap-2">
            {!isAuthorization && (
              <Button variant="primary" size="sm" onClick={reset}>Try again</Button>
            )}
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
