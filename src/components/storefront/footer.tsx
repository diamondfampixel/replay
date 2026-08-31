import Link from "next/link";
import type { StorefrontStore } from "@/lib/storefront/data";

export function StorefrontFooter({ store }: { store: StorefrontStore }) {
  const base = `/s/${store.slug}`;
  return (
    <footer className="border-t border-ink-200 bg-ink-50">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap justify-between gap-8">
          <div className="max-w-xs">
            <p className="text-[15px] font-semibold" style={{ color: "var(--store-secondary)" }}>
              {store.name}
            </p>
            {store.description && (
              <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{store.description}</p>
            )}
          </div>

          <div className="flex gap-12">
            <nav>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Shop</h2>
              <ul className="mt-3 space-y-1.5 text-[13px] text-ink-600">
                <li><Link href={`${base}/shop`} className="hover:text-ink-900">All products</Link></li>
                <li><Link href={`${base}/collections`} className="hover:text-ink-900">Collections</Link></li>
                <li><Link href={`${base}/search`} className="hover:text-ink-900">Search</Link></li>
              </ul>
            </nav>

            {store.footerNav.length > 0 && (
              <nav>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Information</h2>
                <ul className="mt-3 space-y-1.5 text-[13px] text-ink-600">
                  {store.footerNav.map((item) => (
                    <li key={item.href}>
                      <Link href={`${base}${item.href}`} className="hover:text-ink-900">{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-5 text-[12px] text-ink-400">
          <p>© {new Date().getFullYear()} {store.name}</p>
          {store.contactEmail && <a href={`mailto:${store.contactEmail}`} className="hover:text-ink-700">{store.contactEmail}</a>}
          <p>Powered by Halyard</p>
        </div>
      </div>
    </footer>
  );
}
