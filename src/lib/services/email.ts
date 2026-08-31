import "server-only";
import { prisma, type Prisma } from "@/lib/db";
import { sanitizeHtml } from "@/lib/sanitize";
import { audit, authorize, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { formatMoney, toNumber } from "@/lib/money";

export type EmailBlock =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "image"; imageUrl: string; alt?: string }
  | { type: "product"; productId?: string; productTitle?: string }
  | { type: "button"; label: string; href: string }
  | { type: "divider" }
  | { type: "spacer"; size?: "small" | "medium" | "large" };

export function parseBlocks(value: unknown): EmailBlock[] {
  return Array.isArray(value) ? (value as EmailBlock[]) : [];
}

export type CampaignInput = {
  name: string;
  subject: string;
  previewText?: string | null;
  fromName?: string | null;
  fromEmail?: string | null;
  audience?: string;
  blocks?: EmailBlock[];
  scheduledAt?: Date | null;
};

export async function listCampaigns(ctx: ServiceContext) {
  authorize(ctx, "marketing:read");
  return prisma.emailCampaign.findMany({
    where: { storeId: ctx.storeId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCampaign(ctx: ServiceContext, id: string) {
  authorize(ctx, "marketing:read");
  const campaign = await prisma.emailCampaign.findFirst({ where: { id, storeId: ctx.storeId } });
  if (!campaign) throw new NotFoundError("Campaign");
  return campaign;
}

export async function createCampaign(ctx: ServiceContext, input: CampaignInput) {
  authorize(ctx, "marketing:write");
  if (!input.name.trim()) throw new ValidationError("A campaign needs a name.");
  if (!input.subject.trim()) throw new ValidationError("A campaign needs a subject line.");

  const store = await prisma.store.findUniqueOrThrow({
    where: { id: ctx.storeId },
    select: { name: true, slug: true, contactEmail: true },
  });

  const campaign = await prisma.emailCampaign.create({
    data: {
      storeId: ctx.storeId,
      name: input.name,
      subject: input.subject,
      previewText: input.previewText ?? null,
      fromName: input.fromName ?? store.name,
      fromEmail: input.fromEmail ?? store.contactEmail ?? `hello@${store.slug}.test`,
      audience: input.audience ?? "subscribers",
      status: "DRAFT",
      blocks: (input.blocks ?? []) as unknown as Prisma.InputJsonValue,
    },
  });
  await audit(ctx, "campaign.create", { type: "EmailCampaign", id: campaign.id }, { name: campaign.name });
  return campaign;
}

export async function updateCampaign(ctx: ServiceContext, id: string, input: Partial<CampaignInput>) {
  authorize(ctx, "marketing:write");
  const existing = await prisma.emailCampaign.findFirst({ where: { id, storeId: ctx.storeId } });
  if (!existing) throw new NotFoundError("Campaign");
  if (existing.status === "SENT") throw new ValidationError("A sent campaign cannot be edited.");

  const campaign = await prisma.emailCampaign.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.previewText !== undefined && { previewText: input.previewText }),
      ...(input.fromName !== undefined && { fromName: input.fromName }),
      ...(input.fromEmail !== undefined && { fromEmail: input.fromEmail }),
      ...(input.audience !== undefined && { audience: input.audience }),
      ...(input.blocks !== undefined && { blocks: input.blocks as unknown as Prisma.InputJsonValue }),
      ...(input.scheduledAt !== undefined && {
        scheduledAt: input.scheduledAt,
        status: input.scheduledAt ? "SCHEDULED" : "DRAFT",
      }),
    },
  });
  await audit(ctx, "campaign.update", { type: "EmailCampaign", id });
  return campaign;
}

export async function deleteCampaign(ctx: ServiceContext, id: string) {
  authorize(ctx, "marketing:write");
  const campaign = await prisma.emailCampaign.findFirst({ where: { id, storeId: ctx.storeId } });
  if (!campaign) throw new NotFoundError("Campaign");
  if (campaign.status === "SENT") throw new ValidationError("A sent campaign cannot be deleted.");

  await prisma.emailCampaign.delete({ where: { id } });
  await audit(ctx, "campaign.delete", { type: "EmailCampaign", id });
  return true;
}

export async function getAudienceCount(storeId: string, audience: string) {
  if (audience === "customers") {
    return prisma.customer.count({ where: { storeId, acceptsMarketing: true } });
  }
  if (audience === "all") {
    const [subscribers, customers] = await Promise.all([
      prisma.emailSubscriber.count({ where: { storeId, status: "subscribed" } }),
      prisma.customer.count({ where: { storeId, acceptsMarketing: true } }),
    ]);
    return subscribers + customers;
  }
  return prisma.emailSubscriber.count({ where: { storeId, status: "subscribed" } });
}

async function resolveRecipients(storeId: string, audience: string) {
  const emails = new Set<string>();

  if (audience === "subscribers" || audience === "all") {
    const subscribers = await prisma.emailSubscriber.findMany({
      where: { storeId, status: "subscribed" },
      select: { email: true },
    });
    for (const subscriber of subscribers) emails.add(subscriber.email);
  }
  if (audience === "customers" || audience === "all") {
    const customers = await prisma.customer.findMany({
      where: { storeId, acceptsMarketing: true },
      select: { email: true },
    });
    for (const customer of customers) emails.add(customer.email);
  }
  return [...emails];
}

/** Renders campaign blocks to an email-safe HTML document. */
export async function renderCampaignHtml(
  storeId: string,
  campaign: { subject: string; previewText: string | null; blocks: unknown },
) {
  const blocks = parseBlocks(campaign.blocks);
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { name: true, slug: true, primaryColor: true, currency: true },
  });

  const productIds = blocks
    .filter((block): block is Extract<EmailBlock, { type: "product" }> => block.type === "product")
    .map((block) => block.productId)
    .filter((id): id is string => Boolean(id));

  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds }, storeId },
        select: {
          id: true, title: true, slug: true, price: true,
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        },
      })
    : [];
  const productMap = new Map(products.map((product) => [product.id, product]));

  const body = blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `<h2 style="margin:24px 0 8px;font-size:22px;line-height:1.25;color:#1a1a17;">${escapeHtml(block.text)}</h2>`;
        case "text":
          return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#414139;">${escapeHtml(block.text).replace(/\n/g, "<br />")}</p>`;
        case "image":
          return block.imageUrl
            ? `<img src="${escapeHtml(block.imageUrl)}" alt="${escapeHtml(block.alt ?? "")}" style="display:block;width:100%;max-width:560px;border-radius:6px;margin:12px 0;" />`
            : "";
        case "product": {
          const product = block.productId ? productMap.get(block.productId) : null;
          if (!product) return "";
          return `<table role="presentation" width="100%" style="margin:14px 0;border:1px solid #e5e5e1;border-radius:6px;">
            <tr>
              <td width="120" style="padding:12px;">
                <img src="${escapeHtml(product.images[0]?.url ?? "")}" alt="" width="96" style="display:block;border-radius:4px;" />
              </td>
              <td style="padding:12px;vertical-align:middle;">
                <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1a1a17;">${escapeHtml(product.title)}</p>
                <p style="margin:0;font-size:14px;color:#57574f;">${formatMoney(toNumber(product.price), store.currency)}</p>
              </td>
            </tr>
          </table>`;
        }
        case "button":
          return `<p style="margin:20px 0;"><a href="${escapeHtml(block.href)}" style="display:inline-block;background:${store.primaryColor};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:15px;font-weight:500;">${escapeHtml(block.label)}</a></p>`;
        case "divider":
          return `<hr style="border:none;border-top:1px solid #e5e5e1;margin:22px 0;" />`;
        case "spacer":
          return `<div style="height:${block.size === "large" ? 44 : block.size === "small" ? 12 : 26}px;"></div>`;
        default:
          return "";
      }
    })
    .join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" />
<title>${escapeHtml(campaign.subject)}</title></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
${campaign.previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(campaign.previewText)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e1;border-radius:10px;">
<tr><td style="padding:26px 30px;">
<p style="margin:0 0 20px;font-size:15px;font-weight:600;letter-spacing:-0.01em;color:#1a1a17;">${escapeHtml(store.name)}</p>
${sanitizeHtml(body)}
</td></tr>
<tr><td style="padding:18px 30px;border-top:1px solid #e5e5e1;font-size:12px;color:#78786f;">
<p style="margin:0;">You are receiving this because you subscribed to ${escapeHtml(store.name)}.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailProvider = { provider: "resend"; apiKey: string; fromEmail: string } | null;

/** Resolves a real, usable email provider — or null. Never guesses. */
export async function getEmailProvider(storeId: string): Promise<EmailProvider> {
  const envKey = process.env.RESEND_API_KEY?.trim();
  const envFrom = process.env.EMAIL_FROM?.trim();
  if (envKey && envFrom) return { provider: "resend", apiKey: envKey, fromEmail: envFrom };

  const integration = await prisma.integration.findUnique({
    where: { storeId_provider: { storeId, provider: "resend" } },
  });
  if (!integration || integration.status !== "CONNECTED") return null;

  const config = (integration.config ?? {}) as { apiKey?: string; fromEmail?: string };
  if (!config.apiKey || !config.fromEmail) return null;
  return { provider: "resend", apiKey: config.apiKey, fromEmail: config.fromEmail };
}

/**
 * Sends a campaign for real. Refuses without a configured provider rather than
 * pretending — a "sent" campaign in this system always means email left the
 * building.
 */
export async function sendCampaign(ctx: ServiceContext, id: string) {
  authorize(ctx, "marketing:write");
  const campaign = await getCampaign(ctx, id);
  if (campaign.status === "SENT") throw new ValidationError("This campaign has already been sent.");

  const provider = await getEmailProvider(ctx.storeId);
  if (!provider) {
    throw new ValidationError(
      "No email provider is connected. Connect Resend under Integrations (or set RESEND_API_KEY and EMAIL_FROM) before sending.",
    );
  }

  const recipients = await resolveRecipients(ctx.storeId, campaign.audience);
  if (!recipients.length) throw new ValidationError("This audience has no recipients.");

  const html = await renderCampaignHtml(ctx.storeId, campaign);
  await prisma.emailCampaign.update({ where: { id }, data: { status: "SENDING" } });

  let sent = 0;
  const failures: string[] = [];

  // Resend accepts up to 100 recipients per batch call.
  for (let index = 0; index < recipients.length; index += 100) {
    const batch = recipients.slice(index, index + 100);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${campaign.fromName ?? "Store"} <${provider.fromEmail}>`,
          to: provider.fromEmail,
          bcc: batch,
          subject: campaign.subject,
          html,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        failures.push(`${response.status}: ${text.slice(0, 200)}`);
      } else {
        sent += batch.length;
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "network error");
    }
  }

  const succeeded = sent > 0;
  await prisma.emailCampaign.update({
    where: { id },
    data: {
      status: succeeded ? "SENT" : "FAILED",
      sentAt: succeeded ? new Date() : null,
      recipientCount: sent,
    },
  });

  await audit(ctx, "campaign.send", { type: "EmailCampaign", id }, { recipients: sent, failures: failures.length });

  if (!succeeded) {
    throw new ValidationError(`The provider rejected the send. ${failures[0] ?? ""}`.trim());
  }
  return { sent, failures };
}
