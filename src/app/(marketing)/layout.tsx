import type { Metadata } from "next";
import Link from "next/link";
import { WordmarkNight } from "@/components/brand";
import { PageViewTracker, TrackedLink } from "@/components/marketing/page-view";
import { getSessionUser } from "@/lib/session";
import { primaryCta } from "@/lib/launch";

export const metadata: Metadata = {
  title: { default: "Halyard — build your store, run it with AI", template: "%s · Halyard" },
  description:
    "Halyard is an AI-first ecommerce operating system: one place to build a storefront, manage products and orders, read analytics, and run growth — with an assistant that does the work.",
  openGraph: {
    title: "Halyard — build your store, run it with AI",
    description:
      "One operating system for products, orders, analytics, and growth — with an assistant that does the work.",
    images: ["/og.png"],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const cta = primaryCta();

  return (
    <div className="min-h-dvh bg-night-950 font-sans text-night-text antialiased">
      {/* Marketing display + mono faces — loaded only on the public site. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;600;700&family=Spline+Sans+Mono:wght@400;500&display=swap"
      />
      <PageViewTracker />

      <header className="fixed inset-x-0 top-0 z-40 border-b border-night-line bg-night-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-5">
          <Link href="/" aria-label="Halyard home">
            <WordmarkNight />
          </Link>
          <nav className="hidden gap-5 text-[13px] text-night-muted sm:flex">
            <Link href="/#product" className="transition-colors hover:text-night-text">Product</Link>
            <Link href="/pricing" className="transition-colors hover:text-night-text">Pricing</Link>
            <Link href="/#faq" className="transition-colors hover:text-night-text">FAQ</Link>
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
                  href={cta.kind === "waitlist" ? "/#join" : "/signup"}
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
              <Link href="/#product" className="hover:text-night-text">Product</Link>
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
    </div>
  );
}
