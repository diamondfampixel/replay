import type { Metadata } from "next";
import Link from "next/link";
import { requireCapability } from "@/lib/session";
import { serviceContext } from "@/lib/services/context";
import { listIntegrations } from "@/lib/services/integrations";
import {
  INTEGRATION_CATALOG, INTEGRATION_CATEGORIES, availabilityLabel,
} from "@/lib/integrations/catalog";
import { Badge, Dot } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { INTEGRATION_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireCapability("integrations:read");
  const ctx = await serviceContext();
  const params = await searchParams;
  const integrations = await listIntegrations(ctx);
  const stateByProvider = new Map(integrations.map((integration) => [integration.provider, integration]));

  const activeCategory = params.category;
  const visible = activeCategory
    ? INTEGRATION_CATALOG.filter((definition) => definition.category === activeCategory)
    : INTEGRATION_CATALOG;

  const connectedCount = integrations.filter((integration) => integration.status === "CONNECTED").length;

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Integrations"
        description={`${connectedCount} connected of ${INTEGRATION_CATALOG.length} available`}
      />

      <div className="mb-4 rounded-lg border border-ink-200 bg-white px-4 py-3 text-[13px] text-ink-600">
        <span className="font-medium text-ink-900">Each card says exactly what connecting does today.</span>{" "}
        Available connectors work with your own account details. &ldquo;Coming soon&rdquo; ones are being
        set up on Halyard&apos;s side or built next — nothing here shows Connected unless it really works.
      </div>

      <nav className="mb-5 flex flex-wrap gap-1.5">
        <CategoryChip href="/admin/integrations" label="All" active={!activeCategory} />
        {INTEGRATION_CATEGORIES.map((category) => (
          <CategoryChip
            key={category.id}
            href={`/admin/integrations?category=${category.id}`}
            label={category.label}
            active={activeCategory === category.id}
          />
        ))}
      </nav>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((definition) => {
          const state = stateByProvider.get(definition.id);
          const connected = state?.status === "CONNECTED";

          return (
            <Link
              key={definition.id}
              href={`/admin/integrations/${definition.id}`}
              className="group flex flex-col rounded-lg border border-ink-200 bg-white p-4 transition-colors hover:border-ink-300"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold text-white"
                  style={{ background: definition.accent }}
                  aria-hidden="true"
                >
                  {definition.mark}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink-900 group-hover:underline">
                    {definition.name}
                  </p>
                  <p className="text-[11.5px] capitalize text-ink-400">{definition.category.replace(/_/g, " ")}</p>
                </div>
                <Badge tone={INTEGRATION_TONE[state?.status ?? "NOT_CONFIGURED"]}>
                  {connected && <Dot tone="success" />}
                  {connected
                    ? "Connected"
                    : state?.status === "ERROR"
                      ? "Error"
                      : availabilityLabel(definition)}
                </Badge>
              </div>

              <p className="mt-2.5 flex-1 text-[12.5px] leading-relaxed text-ink-600">
                {definition.description}
              </p>

              {connected && state?.accountLabel && (
                <p className="mt-2 truncate text-[11.5px] text-ink-400">{state.accountLabel}</p>
              )}
              {state?.status === "ERROR" && state.lastError && (
                <p className="mt-2 line-clamp-2 text-[11.5px] text-[var(--color-signal-negative)]">
                  {state.lastError}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CategoryChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
        active
          ? "border-ink-900 bg-ink-900 text-white"
          : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
      )}
    >
      {label}
    </Link>
  );
}
