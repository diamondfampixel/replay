import { hasPremiumDesign } from "@/lib/storefront/premium";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { getEditablePage } from "@/lib/services/pages";
import { isAIConfigured } from "@/lib/ai/config";
import { can } from "@/lib/permissions";
import { StoreEditor, type EditorSection } from "@/components/admin/store-editor";
import { listDesignSnapshots } from "@/lib/services/snapshots";
import { resolveTheme } from "@/lib/storefront/theme";

export const metadata: Metadata = { title: "Store editor" };
export const dynamic = "force-dynamic";

export default async function StoreEditorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const auth = await requireCapability("storefront:read");
  const ctx = await serviceContext();
  const params = await searchParams;

  const page = params.page
    ? await prisma.page.findFirst({ where: { id: params.page, storeId: ctx.storeId } })
    : await prisma.page.findFirst({ where: { storeId: ctx.storeId, type: "HOME" } });
  if (!page) notFound();

  const [editable, store, collections, products, aiConfigured, snapshots, premiumUnlocked] = await Promise.all([
    getEditablePage(ctx, page.id),
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { slug: true, theme: true, primaryColor: true, secondaryColor: true } }),
    prisma.collection.findMany({
      where: { storeId: ctx.storeId, visible: true },
      select: { slug: true, title: true },
      orderBy: { position: "asc" },
    }),
    prisma.product.findMany({
      where: { storeId: ctx.storeId, status: "ACTIVE" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 200,
    }),
    isAIConfigured(ctx.storeId),
    listDesignSnapshots(ctx),
    hasPremiumDesign(ctx.organizationId, ctx.storeId),
  ]);
  const theme = resolveTheme({ theme: store.theme, primaryColor: store.primaryColor, secondaryColor: store.secondaryColor });

  return (
    <div className="-mx-4 -my-5 sm:-mx-6 sm:-my-6">
      <StoreEditor
        pageId={page.id}
        pageTitle={page.type === "HOME" ? "Homepage" : page.title}
        storeSlug={store.slug}
        initialSections={editable.sections as EditorSection[]}
        hasUnpublishedChanges={editable.hasUnpublishedChanges}
        collections={collections}
        products={products}
        aiConfigured={aiConfigured}
        canWrite={can(auth.role, "storefront:write")}
        theme={{ dna: theme.dna, direction: theme.direction, motion: theme.motion, cards: theme.cards, schemes: theme.schemes.map((s) => ({ id: s.id, name: s.name })) }}
        snapshots={snapshots.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
        premiumUnlocked={premiumUnlocked}
      />
    </div>
  );
}
