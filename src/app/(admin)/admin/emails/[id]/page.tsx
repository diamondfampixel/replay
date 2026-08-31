import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { serviceContext, NotFoundError } from "@/lib/services/context";
import { getAudienceCount, getCampaign, getEmailProvider, parseBlocks } from "@/lib/services/email";
import { can } from "@/lib/permissions";
import { toNumber } from "@/lib/money";
import { CampaignEditor } from "@/components/admin/campaign-editor";

export const metadata: Metadata = { title: "Campaign" };
export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("marketing:read");
  const ctx = await serviceContext();
  const { id } = await params;

  let campaign;
  try {
    campaign = await getCampaign(ctx, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [store, products, provider, audienceCount] = await Promise.all([
    prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { currency: true } }),
    prisma.product.findMany({
      where: { storeId: ctx.storeId, status: "ACTIVE" },
      select: { id: true, title: true, price: true, images: { take: 1, orderBy: { position: "asc" } } },
      orderBy: { title: "asc" },
      take: 200,
    }),
    getEmailProvider(ctx.storeId),
    getAudienceCount(ctx.storeId, campaign.audience),
  ]);

  return (
    <CampaignEditor
      campaignId={campaign.id}
      status={campaign.status}
      sentAt={campaign.sentAt?.toISOString() ?? null}
      recipientCount={campaign.recipientCount}
      initial={{
        name: campaign.name,
        subject: campaign.subject,
        previewText: campaign.previewText ?? "",
        fromName: campaign.fromName ?? "",
        fromEmail: campaign.fromEmail ?? "",
        audience: campaign.audience,
        blocks: parseBlocks(campaign.blocks),
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
      canWrite={can(auth.role, "marketing:write")}
    />
  );
}
