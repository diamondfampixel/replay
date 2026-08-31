import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { getAudienceCount, getEmailProvider } from "@/lib/services/email";
import { toNumber } from "@/lib/money";
import { CampaignEditor } from "@/components/admin/campaign-editor";
import { EMPTY_CAMPAIGN } from "@/lib/form-defaults";

export const metadata: Metadata = { title: "New campaign" };
export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const ctx = await requireCapability("marketing:write");

  const [store, products, provider, audienceCount] = await Promise.all([
    prisma.store.findUniqueOrThrow({
      where: { id: ctx.storeId },
      select: { name: true, slug: true, contactEmail: true, currency: true },
    }),
    prisma.product.findMany({
      where: { storeId: ctx.storeId, status: "ACTIVE" },
      select: { id: true, title: true, price: true, images: { take: 1, orderBy: { position: "asc" } } },
      orderBy: { title: "asc" },
      take: 200,
    }),
    getEmailProvider(ctx.storeId),
    getAudienceCount(ctx.storeId, "subscribers"),
  ]);

  return (
    <CampaignEditor
      initial={{
        ...EMPTY_CAMPAIGN,
        fromName: store.name,
        fromEmail: store.contactEmail ?? `hello@${store.slug}.test`,
      }}
      audienceCount={audienceCount}
      products={products.map((product) => ({
        id: product.id,
        title: product.title,
        price: toNumber(product.price),
        imageUrl: product.images[0]?.url ?? null,
      }))}
      currency={store.currency}
      providerConnected={Boolean(provider)}
      canWrite
    />
  );
}
