import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/session";
import { serviceContext, NotFoundError } from "@/lib/services/context";
import { getExperiment } from "@/lib/services/experiments";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page";
import { ExperimentDetail } from "@/components/admin/experiment-detail";

export const metadata: Metadata = { title: "Experiment" };
export const dynamic = "force-dynamic";

export default async function ExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("experiments:read");
  const ctx = await serviceContext();
  const { id } = await params;

  let experiment;
  try {
    experiment = await getExperiment(ctx, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const store = await prisma.store.findUniqueOrThrow({
    where: { id: ctx.storeId },
    select: { currency: true, slug: true },
  });

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        breadcrumb={
          <Link href="/admin/experiments" className="inline-flex items-center gap-1 hover:text-ink-800">
            <ArrowLeft className="size-3" />
            A/B Testing
          </Link>
        }
        title={experiment.name}
        description={experiment.hypothesis ?? undefined}
      />
      <ExperimentDetail
        experiment={{
          id: experiment.id,
          name: experiment.name,
          status: experiment.status,
          testType: experiment.testType,
          goal: experiment.goal,
          startedAt: experiment.startedAt?.toISOString() ?? null,
          endedAt: experiment.endedAt?.toISOString() ?? null,
          winnerVariantId: experiment.winnerVariantId,
          isDemo: experiment.isDemo,
          targetLabel:
            experiment.page?.type === "HOME" ? "Homepage"
            : experiment.page?.title ?? experiment.product?.title ?? "—",
          targetHref:
            experiment.product
              ? `/s/${store.slug}/products/${experiment.product.slug}`
              : experiment.page?.type === "HOME"
                ? `/s/${store.slug}`
                : experiment.page
                  ? `/s/${store.slug}/pages/${experiment.page.slug}`
                  : null,
        }}
        results={experiment.results}
        currency={store.currency}
        canWrite={can(auth.role, "experiments:write")}
      />
    </div>
  );
}
