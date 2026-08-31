import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Plus, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { getAudienceCount, getEmailProvider, listCampaigns } from "@/lib/services/email";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DemoTag, EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CAMPAIGN_TONE } from "@/lib/status";
import { formatDate } from "@/lib/format";
import { toNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Emails" };
export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const auth = await requireCapability("marketing:read");
  const ctx = await serviceContext();

  const [campaigns, subscribers, provider, audienceCount] = await Promise.all([
    listCampaigns(ctx),
    prisma.emailSubscriber.count({ where: { storeId: ctx.storeId, status: "subscribed" } }),
    getEmailProvider(ctx.storeId),
    getAudienceCount(ctx.storeId, "subscribers"),
  ]);

  const canWrite = can(auth.role, "marketing:write");

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Emails"
        description={`${subscribers} subscribed contact${subscribers === 1 ? "" : "s"}`}
        actions={
          <>
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin/emails/subscribers">
                <Users />
                Subscribers
              </Link>
            </Button>
            {canWrite && (
              <Button asChild size="sm" variant="primary">
                <Link href="/admin/emails/new">
                  <Plus />
                  New campaign
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div
        className={`mb-4 rounded-lg border px-4 py-3 text-[13px] ${
          provider
            ? "border-pine-200 bg-pine-50 text-pine-800"
            : "border-ink-200 bg-white text-ink-600"
        }`}
      >
        {provider ? (
          <>
            <span className="font-medium">Resend is connected.</span> Campaigns you send go to real
            inboxes — {audienceCount} recipient{audienceCount === 1 ? "" : "s"} on your current list.
          </>
        ) : (
          <>
            <span className="font-medium text-ink-900">No email provider is connected.</span> You can
            write and schedule campaigns, but sending is disabled until you connect one under{" "}
            <Link href="/admin/integrations/resend" className="text-pine-700 underline">
              Integrations → Resend
            </Link>
            . Nothing here fakes a send.
          </>
        )}
      </div>

      <Card className="overflow-hidden">
        {campaigns.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No campaigns yet"
            description="Write a campaign with the block editor, or ask the assistant to draft one for you."
            action={canWrite ? { label: "Create a campaign", href: "/admin/emails/new" } : undefined}
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Campaign</TH>
                  <TH>Status</TH>
                  <TH>Audience</TH>
                  <TH align="right">Recipients</TH>
                  <TH align="right">Open rate</TH>
                  <TH align="right">Click rate</TH>
                  <TH>Date</TH>
                </tr>
              </THead>
              <TBody>
                {campaigns.map((campaign) => (
                  <TR key={campaign.id}>
                    <TD>
                      <Link href={`/admin/emails/${campaign.id}`} className="group block">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium text-ink-900 group-hover:underline">{campaign.name}</span>
                          {campaign.isDemo && <DemoTag label="Demo" />}
                        </span>
                        <span className="block truncate text-[11.5px] text-ink-500">{campaign.subject}</span>
                      </Link>
                    </TD>
                    <TD><Badge tone={CAMPAIGN_TONE[campaign.status]}>{campaign.status.toLowerCase()}</Badge></TD>
                    <TD className="capitalize text-ink-600">{campaign.audience}</TD>
                    <TD align="right" className="tabular">{campaign.recipientCount || "—"}</TD>
                    <TD align="right" className="tabular">
                      {campaign.openRate ? `${toNumber(campaign.openRate).toFixed(1)}%` : "—"}
                    </TD>
                    <TD align="right" className="tabular">
                      {campaign.clickRate ? `${toNumber(campaign.clickRate).toFixed(1)}%` : "—"}
                    </TD>
                    <TD className="whitespace-nowrap text-ink-500">
                      {campaign.sentAt
                        ? `Sent ${formatDate(campaign.sentAt)}`
                        : campaign.scheduledAt
                          ? `Scheduled ${formatDate(campaign.scheduledAt)}`
                          : formatDate(campaign.createdAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {campaigns.some((campaign) => campaign.isDemo && campaign.openRate) && (
        <p className="mt-3 text-[12px] text-ink-400">
          Open and click rates on demo campaigns are seeded values. Real engagement metrics require a
          connected provider that reports them.
        </p>
      )}
    </div>
  );
}
