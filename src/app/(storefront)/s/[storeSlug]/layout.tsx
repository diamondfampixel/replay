import type { Metadata } from "next";
import { getStore } from "@/lib/storefront/data";
import { StorefrontFrame } from "@/components/storefront/frame";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }): Promise<Metadata> {
  const { storeSlug } = await params;
  const store = await getStore(storeSlug);
  return { title: { default: store.name, template: `%s · ${store.name}` }, description: store.description ?? undefined };
}

export default async function StorefrontLayout({ children, params }: { children: React.ReactNode; params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = await getStore(storeSlug);
  return <StorefrontFrame store={store}>{children}</StorefrontFrame>;
}
