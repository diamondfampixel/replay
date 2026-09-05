import Link from "next/link";
import { LogomarkGlyph } from "@/components/brand";
import { TrackedLink } from "@/components/marketing/page-view";
import { Sky } from "@/components/marketing/sky";
import { SocialIcon } from "@/components/marketing/social-icons";
import { WaitlistCta } from "@/components/marketing/waitlist-cta";
import { getSessionUser } from "@/lib/session";
import { primaryCta } from "@/lib/launch";
import { contactEmail, socials } from "@/lib/social";

/**
 * The one-screen public entry point during the gated launch stages.
 * Visual → idea → CTA. Nothing else. Everything real underneath is unchanged:
 * the same waitlist API, attribution, analytics and access rules.
 */
export async function WaitlistScreen() {
  const [user, cta, contact] = await Promise.all([getSessionUser(), primaryCta(), contactEmail()]);
  const marks = socials();

  return (
    <main className="wl" aria-label="Halyard — join the waitlist">
      <Sky />

      <header className="wl-top">
        <Link href="/" className="wl-brand" aria-label="Halyard">
          <svg viewBox="0 0 24 24" className="wl-brand-mark" aria-hidden="true">
            <rect width="24" height="24" rx="6" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.28)" />
            <LogomarkGlyph color="#ffffff" />
          </svg>
          <span className="wl-brand-name">Halyard</span>
        </Link>
        {user ? (
          <Link href="/admin" className="wl-top-link">Open dashboard</Link>
        ) : (
          <TrackedLink href="/login" event="login_click" className="wl-top-link">Log in</TrackedLink>
        )}
      </header>

      <section className="wl-center">
        <h1 className="wl-headline" style={{ textWrap: "balance" }}>
          Build your store.
          <br />
          Let AI run the rest.
        </h1>
        <p className="wl-sub">The AI operating system for commerce.</p>
        <div className="wl-cta-wrap">
          <WaitlistCta label={cta.label} />
        </div>
      </section>

      <footer className="wl-bottom">
        <nav className="wl-links" aria-label="Site">
          {contact && <a href={`mailto:${contact}`}>Contact</a>}
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <ul className="wl-social" aria-label="Social">
          {marks.map((social) =>
            social.href ? (
              <li key={social.id}>
                <a href={social.href} target="_blank" rel="noreferrer" aria-label={social.label}>
                  <SocialIcon id={social.id} className="size-[18px]" />
                </a>
              </li>
            ) : (
              <li key={social.id}>
                <span className="wl-social-soon" role="img" aria-label={`${social.label} — coming soon`} title="Coming soon">
                  <SocialIcon id={social.id} className="size-[18px]" />
                </span>
              </li>
            ),
          )}
        </ul>
      </footer>
    </main>
  );
}
