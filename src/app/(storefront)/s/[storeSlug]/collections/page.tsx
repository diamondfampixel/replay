import type { Metadata } from "next";
import { getCollectionCards, getStore } from "@/lib/storefront/data";
import { StoreLink } from "@/components/storefront/primitives";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getStore(storeSlug);
  const collections = await getCollectionCards(store.id, []);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink-900">Collections</h1>
      {collections.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-ink-300 px-4 py-16 text-center text-[14px] text-ink-500">
          No collections yet.
        </p>
      ) : (
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <StoreLink
              key={collection.id}
              href={`/collections/${collection.slug}`}
              storeSlug={storeSlug}
              className="group block overflow-hidden rounded-lg border border-ink-200"
            >
              <div className="aspect-[3/2] overflow-hidden bg-ink-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={collection.imageUrl ?? "/placeholder.svg"}
                  alt={collection.title}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-4">
                <h2 className="text-[15px] font-medium text-ink-900 group-hover:underline">{collection.title}</h2>
                {collection.description && (
                  <p className="mt-1 line-clamp-2 text-[13px] text-ink-500">{collection.description}</p>
                )}
              </div>
            </StoreLink>
          ))}
        </div>
      )}
    </div>
  );
}
