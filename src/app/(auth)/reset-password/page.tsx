"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { resetPasswordAction } from "@/app/actions/auth";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="rounded-lg border border-ink-200 bg-white p-6">
        <h1 className="text-[17px] font-semibold text-ink-900">Invalid reset link</h1>
        <p className="mt-1 text-[13px] text-ink-500">
          This link is missing its token. Request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="mt-4 inline-block text-[13px] text-pine-700 hover:underline"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,16,14,0.04)]">
      <h1 className="text-[17px] font-semibold text-ink-900">Choose a new password</h1>
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("token", token);
          setError(null);
          startTransition(async () => {
            const result = await resetPasswordAction(formData);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            toast.success("Password updated");
            router.replace("/login");
          });
        }}
      >
        <Field label="New password" htmlFor="password" required error={error ?? undefined}>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Button type="submit" variant="primary" className="w-full" loading={pending}>
          Update password
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-40 skeleton rounded-lg" />}>
      <ResetForm />
    </Suspense>
  );
}
