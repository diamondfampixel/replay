import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/storefront/data";
import { requireCapability } from "@/lib/session";
import { getCatalogTheme } from "@/lib/storefront/themes";
import { renderThemeForStore } from "@/lib/services/themes";
import { StorefrontFrame } from "@/components/storefront/frame";
import { SectionRenderer } from "@/components/storefront/sections";

export const metadata: Metadata = { title: "Theme preview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Renders the merchant's own store through a catalogue theme without writing
 * anything. Admin-only and store-scoped: the same capability the editor needs,
 * and the store in the URL must be the signed-in operator's store.
 */
export default async function ThemePreviewPage({ params }: { params: Promise<{ storeSlug: string; themeId: string }> }) {
  const { storeSlug, themeId } = await params;
  const auth = await requireCapability("storefront:read");
  const store = await getStore(storeSlug);
  if (auth.storeId !== store.id) notFound();
  const theme = getCatalogTheme(themeId);
  if (!theme) notFound();

  const { resolved, sections } = await renderThemeForStore(store.id, theme);
  const previewStore = { ...store, theme: resolved, primaryColor: resolved.vars["--st-accent"] };

  return (
    <StorefrontFrame
      store={previewStore}
      banner={<div role="status" className="relative z-50 bg-pine-700 px-4 py-1.5 text-center text-[11.5px] text-white">Previewing the “{theme.name}” theme with your own store — nothing is saved until you apply it.</div>}
    >
      {sections.map((section, index) => (
        <SectionRenderer key={`${theme.id}-${index}`} store={previewStore} section={{ id: `preview-${index}`, type: section.type, visible: true, config: section.config }} preview index={index} />
      ))}
    </StorefrontFrame>
  );
}
