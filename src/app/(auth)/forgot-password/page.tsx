"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { forgotPasswordAction } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,16,14,0.04)]">
      <h1 className="text-[17px] font-semibold text-ink-900">Reset your password</h1>
      <p className="mt-1 text-[13px] text-ink-500">
        We&apos;ll send a reset link to your email address.
      </p>

      {sent ? (
        <div className="mt-5 space-y-3">
          <div className="rounded-md border border-pine-200 bg-pine-50 px-3 py-2.5 text-[13px] text-pine-800">
            If an account exists for that address, a reset link is on its way.
          </div>
          {devToken && (
            <div className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2.5 text-[12.5px] text-ink-600">
              <p className="font-medium text-ink-800">Development mode</p>
              <p className="mt-1">
                No email provider is configured, so the link is shown here instead:
              </p>
              <Link
                href={`/reset-password?token=${devToken}`}
                className="mt-1.5 block break-all text-pine-700 hover:underline"
              >
                /reset-password?token={devToken}
              </Link>
            </div>
          )}
          <Link href="/login" className="block text-[13px] text-pine-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            setError(null);
            startTransition(async () => {
              const result = await forgotPasswordAction(formData);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setDevToken(result.data.devToken ?? null);
              setSent(true);
            });
          }}
        >
          <Field label="Email" htmlFor="email" required error={error ?? undefined}>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={pending}>
            Send reset link
          </Button>
          <Link href="/login" className="block text-center text-[13px] text-ink-500 hover:text-ink-800">
            Back to sign in
          </Link>
        </form>
      )}
    </div>
  );
}
