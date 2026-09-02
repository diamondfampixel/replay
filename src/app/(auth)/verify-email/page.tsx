import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmailToken } from "@/lib/services/verification";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Confirm email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const verified = token ? await verifyEmailToken(token) : false;

  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink-900">
        {verified ? "Email confirmed" : "This link didn't work"}
      </h1>
      <p className="mt-2 text-[14px] text-ink-600">
        {verified
          ? "You're all set. Thanks for confirming."
          : "The confirmation link is invalid, expired, or already used. You can request a fresh one from the banner inside the app."}
      </p>
      <Button asChild className="mt-6">
        <Link href="/admin">Go to your dashboard</Link>
      </Button>
    </div>
  );
}
