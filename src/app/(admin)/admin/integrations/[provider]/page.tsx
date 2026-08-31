import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { getIntegrationView } from "@/lib/services/integrations";
import { getIntegration, IMPLEMENTATION_LABELS } from "@/lib/integrations/catalog";
import { can } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Dot } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { IntegrationForm } from "@/components/admin/integration-form";
import { INTEGRATION_TONE } from "@/lib/status";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ provider: string }>;
}): Promise<Metadata> {
  const { provider } = await params;
  const definition = getIntegration(provider);
  return { title: definition?.name ?? "Integration" };
}

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const auth = await requireCapability("integrations:read");
  const ctx = await serviceContext();
  const { provider } = await params;

  const definition = getIntegration(provider);
  if (!definition) notFound();

  const state = await getIntegrationView(ctx, provider);
  const connected = state?.status === "CONNECTED";

  return (
    <div className="mx-auto max-w-[820px]">
      <PageHeader
        breadcrumb={
          <Link href="/admin/integrations" className="inline-flex items-center gap-1 hover:text-ink-800">
            <ArrowLeft className="size-3" />
            Integrations
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <span
              className="flex size-9 items-center justify-center rounded-md text-[13px] font-semibold text-white"
              style={{ background: definition.accent }}
              aria-hidden="true"
            >
              {definition.mark}
            </span>
            {definition.name}
          </span>
        }
        description={definition.description}
        actions={
          <Badge tone={INTEGRATION_TONE[state?.status ?? "NOT_CONFIGURED"]}>
            {connected && <Dot tone="success" />}
            {connected ? "Connected" : state?.status === "ERROR" ? "Error" : IMPLEMENTATION_LABELS[definition.implementation]}
          </Badge>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>What connecting does</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[13.5px] leading-relaxed text-ink-700">{definition.capability}</p>

            {definition.implementation === "planned" && (
              <div className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2.5 text-[12.5px] text-ink-600">
                This connector is a slot, not a working integration. Connecting is disabled rather
                than storing credentials that nothing would read. The interface, credential storage
                and audit trail are already in place, so wiring it up is a matter of adding the API
                calls.
              </div>
            )}

            {definition.envVar && (
              <p className="text-[12.5px] text-ink-500">
                Can also be supplied server-side via{" "}
                <code className="rounded bg-ink-100 px-1 py-0.5 text-[11.5px]">{definition.envVar}</code>.
                {state?.fromEnvironment && " That environment variable is currently set and takes precedence."}
              </p>
            )}

            {definition.docsUrl && (
              <a
                href={definition.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12.5px] text-pine-700 hover:underline"
              >
                Provider documentation
                <ExternalLink className="size-3" />
              </a>
            )}
          </CardContent>
        </Card>

        <IntegrationForm
          provider={definition.id}
          name={definition.name}
          fields={definition.fields}
          implementation={definition.implementation}
          connected={connected}
          fromEnvironment={state?.fromEnvironment ?? false}
          configuredKeys={state?.configuredKeys ?? []}
          canWrite={can(auth.role, "integrations:write")}
        />

        {(connected || state?.status === "ERROR") && (
          <Card>
            <CardHeader><CardTitle>Connection</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              {state?.accountLabel && (
                <Row label="Account" value={state.accountLabel} />
              )}
              {state?.connectedAt && <Row label="Connected" value={formatDate(state.connectedAt, "datetime")} />}
              {state?.lastError && (
                <p className="rounded-md border border-[#f5cec6] bg-[#fdeeeb] px-3 py-2 text-[12.5px] text-[#8c2817]">
                  {state.lastError}
                </p>
              )}
              <p className="border-t border-ink-200 pt-2 text-[11.5px] text-ink-400">
                Secrets are stored server-side and are never sent to the browser.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className="truncate text-ink-800">{value}</span>
    </div>
  );
}
