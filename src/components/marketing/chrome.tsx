import Link from "next/link";
import { WordmarkNight } from "@/components/brand";
import { TrackedLink } from "@/components/marketing/page-view";
import { getSessionUser } from "@/lib/session";
import { primaryCta } from "@/lib/launch";

/**
 * The full marketing site's header and footer. Pages opt in by rendering
 * inside <MarketingShell>; the one-screen waitlist deliberately does not.
 */
export async function MarketingShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const cta = primaryCta();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-night-line bg-night-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-5">
          <Link href="/" aria-label="Halyard home">
            <WordmarkNight />
          </Link>
          <nav className="hidden gap-5 text-[13px] text-night-muted sm:flex">
            <Link href="/product#product" className="transition-colors hover:text-night-text">Product</Link>
            <Link href="/pricing" className="transition-colors hover:text-night-text">Pricing</Link>
            <Link href="/product#faq" className="transition-colors hover:text-night-text">FAQ</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link
                href="/admin"
                className="rounded-lg bg-night-text px-3.5 py-1.5 text-[13px] font-medium text-night-950 transition-colors hover:bg-white"
              >
                Open dashboard
              </Link>
            ) : (
              <>
                <TrackedLink
                  href="/login"
                  event="login_click"
                  className="rounded-lg px-3 py-1.5 text-[13px] text-night-muted transition-colors hover:text-night-text"
                >
                  Sign in
                </TrackedLink>
                <Link
                  href={cta.kind === "waitlist" ? "/" : "/signup"}
                  className="rounded-lg bg-night-text px-3.5 py-1.5 text-[13px] font-medium text-night-950 transition-colors hover:bg-white"
                >
                  {cta.label}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-night-line bg-night-950">
        <div className="mx-auto w-full max-w-6xl px-5 py-10">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <WordmarkNight />
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-night-muted">
              <Link href="/product#product" className="hover:text-night-text">Product</Link>
              <Link href="/pricing" className="hover:text-night-text">Pricing</Link>
              <Link href="/login" className="hover:text-night-text">Sign in</Link>
              <Link href="/privacy" className="hover:text-night-text">Privacy</Link>
              <Link href="/terms" className="hover:text-night-text">Terms</Link>
              <Link href="/refunds" className="hover:text-night-text">Refunds</Link>
            </nav>
          </div>
          <p className="mt-8 text-[12px] text-night-faint">
            © {new Date().getFullYear()} Halyard. Product screens show the seeded demonstration
            store — not a real business.
          </p>
        </div>
      </footer>
    </>
  );
}
