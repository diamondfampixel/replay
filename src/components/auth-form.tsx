"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";

type Mode = "login" | "signup";

export function AuthForm({
  mode,
  action,
}: {
  mode: Mode;
  action: (formData: FormData) => Promise<ActionResult<{ redirect: string }>>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        return;
      }
      router.replace(result.data.redirect);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,16,14,0.04)]">
      <h1 className="text-[17px] font-semibold text-ink-900">
        {mode === "login" ? "Sign in to Halyard" : "Create your Halyard account"}
      </h1>
      <p className="mt-1 text-[13px] text-ink-500">
        {mode === "login"
          ? "Operate your store and your AI assistant from one place."
          : "Set up a store in a few minutes — or explore a fully populated demo."}
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
        {mode === "signup" && (
          <Field label="Name" htmlFor="name" required error={errors.name}>
            <Input id="name" name="name" autoComplete="name" placeholder="Alex Rivera" required />
          </Field>
        )}
        <Field label="Email" htmlFor="email" required error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          required
          error={errors.password}
          hint={mode === "signup" ? "At least 8 characters." : undefined}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </Field>

        {formError && (
          <div
            role="alert"
            className="rounded-md border border-[#f5cec6] bg-[#fdeeeb] px-3 py-2 text-[13px] text-[#8c2817]"
          >
            {formError}
          </div>
        )}

        <Button type="submit" variant="primary" className="w-full" loading={pending}>
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-[13px]">
        {mode === "login" ? (
          <>
            <Link href="/signup" className="text-pine-700 hover:underline">
              Create an account
            </Link>
            <Link href="/forgot-password" className="text-ink-500 hover:text-ink-800">
              Forgot password?
            </Link>
          </>
        ) : (
          <Link href="/login" className="text-pine-700 hover:underline">
            I already have an account
          </Link>
        )}
      </div>

      {mode === "login" && (
        <DemoHint
          onFill={() => {
            const form = document.querySelector("form");
            if (!form) return;
            (form.querySelector("#email") as HTMLInputElement).value = "demo@halyard.app";
            (form.querySelector("#password") as HTMLInputElement).value = "demo1234";
            toast.info("Demo credentials filled in", { description: "Press Sign in to continue." });
          }}
        />
      )}
    </div>
  );
}

function DemoHint({ onFill }: { onFill: () => void }) {
  return (
    <div className="mt-5 rounded-md border border-ink-200 bg-ink-50 px-3 py-2.5">
      <p className="text-[12.5px] text-ink-600">
        <span className="font-medium text-ink-800">Demo account</span> — seeded store with products,
        orders, analytics and experiments.
      </p>
      <button
        type="button"
        onClick={onFill}
        className="mt-1.5 text-[12.5px] font-medium text-pine-700 hover:underline"
      >
        Use demo@halyard.app
      </button>
    </div>
  );
}
