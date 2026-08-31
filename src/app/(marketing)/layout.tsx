import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/session";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
          <Link href="/">
            <Wordmark />
          </Link>
          <nav className="hidden gap-5 text-[13px] text-ink-600 sm:flex">
            <Link href="/features" className="hover:text-ink-900">Features</Link>
            <Link href="/pricing" className="hover:text-ink-900">Pricing</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Button asChild size="sm" variant="primary">
                <Link href="/admin">Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm" variant="primary">
                  <Link href="/signup">Start free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-ink-200 bg-ink-50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
          <Wordmark />
          <nav className="flex flex-wrap gap-5 text-[13px] text-ink-600">
            <Link href="/features" className="hover:text-ink-900">Features</Link>
            <Link href="/pricing" className="hover:text-ink-900">Pricing</Link>
            <Link href="/login" className="hover:text-ink-900">Sign in</Link>
            <Link href="/signup" className="hover:text-ink-900">Create account</Link>
          </nav>
          <p className="text-[12px] text-ink-400">
            © {new Date().getFullYear()} Halyard. A demonstration platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
