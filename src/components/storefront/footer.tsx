import Link from "next/link";
import type { StorefrontStore } from "@/lib/storefront/data";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { SocialIcon } from "@/components/marketing/social-icons";
import type { SocialKey } from "@/lib/storefront/theme";
import { cn } from "@/lib/utils";

const SOCIAL_LABEL: Record<SocialKey, string> = { instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube", linkedin: "LinkedIn", facebook: "Facebook", pinterest: "Pinterest" };

/**
 * Footer with four compositions (columns / minimal / centered / brand). Social
 * icons render only for networks with a real URL in the theme — never a dead
 * placeholder link.
 */
export function StorefrontFooter({ store }: { store: StorefrontStore }) {
  const base = `/s/${store.slug}`;
  const f = store.theme.footer;
  const scheme = f.scheme === "contrast" ? { background: "var(--st-contrast-bg)", color: "var(--st-contrast-fg)", "--st-muted-fg": "color-mix(in srgb, currentColor 72%, transparent)", "--st-border": "color-mix(in srgb, currentColor 18%, transparent)", "--st-border-strong": "color-mix(in srgb, currentColor 40%, transparent)", "--st-btn-bg": "var(--st-contrast-fg)", "--st-btn-fg": "var(--st-contrast-bg)", "--st-btn-border": "var(--st-contrast-fg)", "--st-bg": "var(--st-contrast-bg)", "--st-fg": "var(--st-contrast-fg)" }
    : f.scheme === "base" ? { background: "var(--st-bg)", color: "var(--st-fg)" }
    : { background: "var(--st-surface-alt)", color: "var(--st-fg)" };

  const wordmark = (
    <p className="st-display st-heading-transform text-[16px]" style={{ fontWeight: "var(--st-heading-weight)" as React.CSSProperties["fontWeight"] }}>{store.name}</p>
  );
  const statement = f.brandStatement || store.description;
  const social = f.showSocial && f.social.length > 0 && (
    <ul className="flex flex-wrap gap-3" aria-label="Social">
      {f.social.map((s) => (
        <li key={s.key}>
          <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex size-9 items-center justify-center rounded-full border transition-opacity hover:opacity-70" style={{ borderColor: "var(--st-border-strong)" }} aria-label={SOCIAL_LABEL[s.key]}>
            <SocialIcon id={s.key as never} className="size-4" />
          </a>
        </li>
      ))}
    </ul>
  );
  const shopNav = (
    <nav aria-label="Shop">
      <h2 className="st-eyebrow mb-3">Shop</h2>
      <ul className="space-y-1.5 text-[13.5px]">
        <li><Link href={`${base}/shop`} className="hover:opacity-70">All products</Link></li>
        <li><Link href={`${base}/collections`} className="hover:opacity-70">Collections</Link></li>
        <li><Link href={`${base}/search`} className="hover:opacity-70">Search</Link></li>
      </ul>
    </nav>
  );
  const infoNav = store.footerNav.length > 0 && (
    <nav aria-label="Information">
      <h2 className="st-eyebrow mb-3">Information</h2>
      <ul className="space-y-1.5 text-[13.5px]">
        {store.footerNav.map((item) => (
          <li key={item.href}><Link href={`${base}${item.href}`} className="hover:opacity-70">{item.label}</Link></li>
        ))}
      </ul>
    </nav>
  );
  const newsletter = f.showNewsletter && (
    <div className="max-w-sm">
      <h2 className="st-eyebrow mb-3">Newsletter</h2>
      <NewsletterForm storeSlug={store.slug} />
    </div>
  );
  const legal = (
    <div className={cn("st-muted mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-5 text-[12px]", f.style === "centered" ? "justify-center" : "justify-between")} style={{ borderColor: "var(--st-border)" }}>
      <p>© {new Date().getFullYear()} {store.name}</p>
      {store.contactEmail && <a href={`mailto:${store.contactEmail}`} className="hover:opacity-70">{store.contactEmail}</a>}
      {store.showHalyardCredit && <Link href="/" className="hover:opacity-70">Built on Halyard</Link>}
    </div>
  );

  return (
    <footer className="st-footer border-t" style={{ ...scheme, borderColor: "var(--st-border)" } as React.CSSProperties} data-footer={f.style}>
      <div className="mx-auto px-5 py-12 sm:px-7" style={{ maxWidth: "var(--st-max-width)" }}>
        {f.style === "minimal" ? (
          <div className="flex flex-wrap items-center justify-between gap-6">
            {wordmark}
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px]" aria-label="Footer">
              <Link href={`${base}/shop`} className="hover:opacity-70">Shop</Link>
              <Link href={`${base}/collections`} className="hover:opacity-70">Collections</Link>
              {store.footerNav.map((item) => <Link key={item.href} href={`${base}${item.href}`} className="hover:opacity-70">{item.label}</Link>)}
            </nav>
            {social}
          </div>
        ) : f.style === "centered" ? (
          <div className="flex flex-col items-center gap-6 text-center">
            {wordmark}
            {statement && <p className="st-muted max-w-md text-[13.5px] leading-relaxed">{statement}</p>}
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13.5px]" aria-label="Footer">
              <Link href={`${base}/shop`} className="hover:opacity-70">Shop</Link>
              <Link href={`${base}/collections`} className="hover:opacity-70">Collections</Link>
              {store.footerNav.map((item) => <Link key={item.href} href={`${base}${item.href}`} className="hover:opacity-70">{item.label}</Link>)}
            </nav>
            {social}
            {newsletter && <div className="w-full max-w-sm">{newsletter}</div>}
          </div>
        ) : f.style === "brand" ? (
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="st-display st-heading-transform st-h-lg max-w-xl">{statement || store.name}</p>
              <div className="mt-6">{social}</div>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:col-span-5">
              {shopNav}
              {infoNav}
              {newsletter && <div className="sm:col-span-2">{newsletter}</div>}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-between gap-10">
            <div className="max-w-xs">
              {wordmark}
              {statement && <p className="st-muted mt-2.5 text-[13px] leading-relaxed">{statement}</p>}
              <div className="mt-4">{social}</div>
            </div>
            <div className="flex flex-wrap gap-12">
              {shopNav}
              {infoNav}
              {newsletter}
            </div>
          </div>
        )}
        {legal}
      </div>
    </footer>
  );
}
