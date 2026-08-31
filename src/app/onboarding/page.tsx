import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActiveContext, requireUser } from "@/lib/session";
import { isAIConfigured } from "@/lib/ai/config";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { Wordmark } from "@/components/brand";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Set up your store" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  const ctx = await getActiveContext();
  if (ctx) redirect("/admin");

  // AI availability here depends only on the environment: there is no store yet.
  const aiConfigured = await isAIConfigured("");

  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="flex h-14 items-center justify-between border-b border-ink-200 bg-white px-5">
        <Wordmark />
        <form action={logoutAction}>
          <Button type="submit" size="sm" variant="ghost">
            Sign out {user.email}
          </Button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <OnboardingWizard aiConfigured={aiConfigured} />
      </main>
    </div>
  );
}
