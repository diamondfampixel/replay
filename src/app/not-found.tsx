import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Wordmark />
      <p className="tabular mt-8 text-[56px] font-semibold leading-none tracking-[-0.03em] text-ink-200">
        404
      </p>
      <h1 className="mt-3 text-[20px] font-semibold text-ink-900">This page does not exist</h1>
      <p className="mt-1.5 max-w-md text-[14px] text-ink-500">
        The link may be out of date, or the record may have been deleted.
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild variant="primary">
          <Link href="/admin">Go to dashboard</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
