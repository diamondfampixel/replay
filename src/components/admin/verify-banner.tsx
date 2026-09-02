"use client";

import * as React from "react";
import { toast } from "sonner";
import { resendVerificationAction } from "@/app/actions/auth";

/** Thin, persistent reminder shown until the account's email is confirmed. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-[12.5px] text-amber-900">
      <span>
        Confirm your email — we sent a link to <span className="font-medium">{email}</span>.
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const result = await resendVerificationAction();
          setBusy(false);
          if (result.ok) toast.success(result.message ?? "Sent");
          else toast.error(result.error);
        }}
        className="font-medium underline underline-offset-2 hover:text-amber-950 disabled:opacity-60"
      >
        Resend link
      </button>
    </div>
  );
}
