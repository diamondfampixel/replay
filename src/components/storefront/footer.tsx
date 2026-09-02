import Link from "next/link";
import type { StorefrontStore } from "@/lib/storefront/data";

export function StorefrontFooter({ store }: { store: StorefrontStore }) {
  const base = `/s/${store.slug}`;
  return (
    <footer className="border-t" style={{ background: "var(--st-surface-alt)", borderColor: "var(--st-border)" }}>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap justify-between gap-8">
          <div className="max-w-xs">
            <p className="st-display text-[16px]" style={{ color: "var(--st-fg)", fontWeight: "var(--st-heading-weight)" as React.CSSProperties["fontWeight"] }}>
              {store.name}
            </p>
            {store.description && (
              <p className="st-muted mt-2.5 text-[13px] leading-relaxed">{store.description}</p>
            )}
          </div>

          <div className="flex gap-12">
            <nav>
              <h2 className="st-muted text-[11px] font-semibold uppercase tracking-[0.08em]">Shop</h2>
              <ul className="mt-3 space-y-1.5 text-[13px]" style={{ color: "var(--st-fg)" }}>
                <li><Link href={`${base}/shop`} className="hover:opacity-70">All products</Link></li>
                <li><Link href={`${base}/collections`} className="hover:opacity-70">Collections</Link></li>
                <li><Link href={`${base}/search`} className="hover:opacity-70">Search</Link></li>
              </ul>
            </nav>

            {store.footerNav.length > 0 && (
              <nav>
                <h2 className="st-muted text-[11px] font-semibold uppercase tracking-[0.08em]">Information</h2>
                <ul className="mt-3 space-y-1.5 text-[13px]" style={{ color: "var(--st-fg)" }}>
                  {store.footerNav.map((item) => (
                    <li key={item.href}>
                      <Link href={`${base}${item.href}`} className="hover:opacity-70">{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </div>

        <div className="st-muted mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-[12px]" style={{ borderColor: "var(--st-border)" }}>
          <p>© {new Date().getFullYear()} {store.name}</p>
          {store.contactEmail && <a href={`mailto:${store.contactEmail}`} className="hover:opacity-70">{store.contactEmail}</a>}
          {store.showHalyardCredit && (
            <Link href="/" className="hover:opacity-70">
              Built on Halyard
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
}
