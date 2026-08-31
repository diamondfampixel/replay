"use client";

import { useEffect } from "react";

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[storefront] unhandled error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-5 py-28 text-center">
      <h1 className="text-[20px] font-semibold text-ink-900">Something went wrong</h1>
      <p className="mt-1.5 text-[14.5px] text-ink-500">
        Sorry — this page could not be loaded. Your cart is safe.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-11 items-center rounded-md bg-ink-900 px-6 text-[14px] font-medium text-white hover:bg-ink-800"
      >
        Try again
      </button>
    </div>
  );
}
