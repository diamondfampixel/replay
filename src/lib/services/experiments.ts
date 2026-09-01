import "server-only";
import { assertCanStartExperiment } from "@/lib/services/billing";
import { prisma, type Prisma, type ExperimentStatus } from "@/lib/db";
import { hashString } from "@/lib/utils";
import { round2, toNumber } from "@/lib/money";
import { audit, authorize, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";

export { TEST_TYPES, GOALS, testTypeMeta } from "@/lib/experiment-meta";

export type VariantAssignment = {
  experimentId: string;
  experimentName: string;
  variantId: string;
  variantName: string;
  changes: Record<string, unknown>;
};

/**
 * Deterministic bucketing: the same visitor session always lands in the same
 * variant for a given experiment, with no cookie or server state required.
 */
export function assignVariant<T extends { id: string; name: string; weight: number; changes: unknown }>(
  experimentId: string,
  variants: T[],
  sessionId: string,
): T | null {
  const usable = variants.filter((variant) => variant.weight > 0);
  if (!usable.length) return null;

  const total = usable.reduce((sum, variant) => sum + variant.weight, 0);
  const bucket = (hashString(`${experimentId}:${sessionId}`) % 10_000) / 10_000;
  let cursor = 0;
  for (const variant of usable) {
    cursor += variant.weight / total;
    if (bucket < cursor) return variant;
  }
  return usable[usable.length - 1];
}

/** Running experiments that apply to a given storefront surface. */
export async function getAssignmentsFor(
  storeId: string,
  target: { pageId?: string | null; productId?: string | null },
  sessionId: string,
): Promise<VariantAssignment[]> {
  if (!sessionId) return [];

  const experiments = await prisma.experiment.findMany({
    where: {
      storeId,
      status: "RUNNING",
      OR: [
        ...(target.pageId ? [{ pageId: target.pageId }] : []),
        ...(target.productId ? [{ productId: target.productId }] : []),
      ],
    },
    include: { variants: { orderBy: { name: "asc" } } },
  });

  const assignments: VariantAssignment[] = [];
  for (const experiment of experiments) {
    const variant = assignVariant(experiment.id, experiment.variants, sessionId);
    if (!variant) continue;
    assignments.push({
      experimentId: experiment.id,
      experimentName: experiment.name,
      variantId: variant.id,
      variantName: variant.name,
      changes: (variant.changes ?? {}) as Record<string, unknown>,
    });
  }
  return assignments;
}

/** Impressions and conversions are unique per session, enforced by the schema. */
/**
 * Filters client-supplied experiment assignments down to the ones that are
 * actually real for this store.
 *
 * The public tracking endpoint takes experiment and variant ids from the
 * request body, so without this a caller could post impressions into another
 * organization's test, into a test that is not running, or pair a variant with
 * an experiment it does not belong to — all of which would quietly corrupt the
 * results another operator makes decisions from.
 */
export async function filterValidAssignments(
  storeId: string,
  assignments: { experimentId: string; variantId: string }[],
): Promise<{ experimentId: string; variantId: string }[]> {
  if (!assignments.length) return [];

  const variants = await prisma.experimentVariant.findMany({
    where: {
      id: { in: assignments.map((a) => a.variantId) },
      experiment: { storeId, status: "RUNNING" },
    },
    select: { id: true, experimentId: true },
  });

  const allowed = new Map(variants.map((v) => [v.id, v.experimentId]));
  return assignments.filter((a) => allowed.get(a.variantId) === a.experimentId);
}

export async function recordExperimentEvent(input: {
  experimentId: string;
  variantId: string;
  sessionId: string;
  type: "impression" | "conversion";
  orderId?: string | null;
  value?: number | null;
}) {
  try {
    await prisma.experimentEvent.create({
      data: {
        experimentId: input.experimentId,
        variantId: input.variantId,
        sessionId: input.sessionId,
        type: input.type,
        orderId: input.orderId ?? null,
        value: input.value ?? null,
      },
    });
  } catch {
    // Unique constraint — this session already recorded this event type.
  }
}

/**
 * Records conversions for every running experiment this session was exposed to.
 * Called when an order is placed or another goal event fires.
 */
export async function recordConversions(
  storeId: string,
  sessionId: string,
  goal: string,
  options: { orderId?: string; value?: number } = {},
) {
  if (!sessionId) return;

  const impressions = await prisma.experimentEvent.findMany({
    where: {
      sessionId,
      type: "impression",
      experiment: { storeId, status: "RUNNING", goal },
    },
    select: { experimentId: true, variantId: true },
  });

  for (const impression of impressions) {
    await recordExperimentEvent({
      experimentId: impression.experimentId,
      variantId: impression.variantId,
      sessionId,
      type: "conversion",
      orderId: options.orderId ?? null,
      value: options.value ?? null,
    });
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type VariantResult = {
  id: string;
  name: string;
  isControl: boolean;
  weight: number;
  changes: Record<string, unknown>;
  visitors: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  revenuePerVisitor: number;
  upliftVsControl: number | null;
  /** Two-tailed p-value against the control, or null when not computable. */
  pValue: number | null;
};

export type ExperimentResults = {
  variants: VariantResult[];
  totalVisitors: number;
  totalConversions: number;
  leader: VariantResult | null;
  /** Honest read: only true when p < 0.05 AND both arms have enough data. */
  significant: boolean;
  /** Why a call cannot be made yet, when it cannot. */
  readiness: string;
  minimumVisitorsPerVariant: number;
};

/** Standard normal CDF via the Abramowitz–Stegun erf approximation. */
function normalCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (1.330274429 * t ** 4 - 1.821255978 * t ** 3 + 1.781477937 * t ** 2 - 0.356563782 * t + 0.319381530);
  return z > 0 ? 1 - p : p;
}

/** Two-proportion z-test. */
function twoProportionPValue(
  conversionsA: number, visitorsA: number,
  conversionsB: number, visitorsB: number,
): number | null {
  if (visitorsA < 1 || visitorsB < 1) return null;
  const p1 = conversionsA / visitorsA;
  const p2 = conversionsB / visitorsB;
  const pooled = (conversionsA + conversionsB) / (visitorsA + visitorsB);
  if (pooled <= 0 || pooled >= 1) return null;
  const standardError = Math.sqrt(pooled * (1 - pooled) * (1 / visitorsA + 1 / visitorsB));
  if (standardError === 0) return null;
  const z = (p2 - p1) / standardError;
  return round2(2 * (1 - normalCdf(Math.abs(z))) * 1000) / 1000;
}

const MIN_VISITORS_PER_VARIANT = 200;
const MIN_CONVERSIONS_PER_VARIANT = 10;

export async function getExperimentResults(experimentId: string): Promise<ExperimentResults> {
  const [variants, grouped, revenue] = await Promise.all([
    prisma.experimentVariant.findMany({
      where: { experimentId },
      orderBy: { name: "asc" },
    }),
    prisma.experimentEvent.groupBy({
      by: ["variantId", "type"],
      where: { experimentId },
      _count: true,
    }),
    prisma.experimentEvent.groupBy({
      by: ["variantId"],
      where: { experimentId, type: "conversion" },
      _sum: { value: true },
    }),
  ]);

  const counts = new Map<string, { impression: number; conversion: number }>();
  for (const row of grouped) {
    const entry = counts.get(row.variantId) ?? { impression: 0, conversion: 0 };
    if (row.type === "impression") entry.impression = row._count;
    if (row.type === "conversion") entry.conversion = row._count;
    counts.set(row.variantId, entry);
  }
  const revenueByVariant = new Map(revenue.map((row) => [row.variantId, toNumber(row._sum.value)]));

  const control = variants.find((variant) => variant.isControl) ?? variants[0];
  const controlCounts = control ? counts.get(control.id) ?? { impression: 0, conversion: 0 } : null;
  const controlRate = controlCounts && controlCounts.impression
    ? controlCounts.conversion / controlCounts.impression
    : 0;

  const results: VariantResult[] = variants.map((variant) => {
    const entry = counts.get(variant.id) ?? { impression: 0, conversion: 0 };
    const rate = entry.impression ? entry.conversion / entry.impression : 0;
    const variantRevenue = revenueByVariant.get(variant.id) ?? 0;

    return {
      id: variant.id,
      name: variant.name,
      isControl: variant.isControl,
      weight: variant.weight,
      changes: (variant.changes ?? {}) as Record<string, unknown>,
      visitors: entry.impression,
      conversions: entry.conversion,
      conversionRate: round2(rate * 100),
      revenue: round2(variantRevenue),
      revenuePerVisitor: entry.impression ? round2(variantRevenue / entry.impression) : 0,
      upliftVsControl:
        !control || variant.id === control.id || controlRate === 0
          ? null
          : round2(((rate - controlRate) / controlRate) * 100),
      pValue:
        !control || variant.id === control.id || !controlCounts
          ? null
          : twoProportionPValue(controlCounts.conversion, controlCounts.impression, entry.conversion, entry.impression),
    };
  });

  const totalVisitors = results.reduce((sum, result) => sum + result.visitors, 0);
  const totalConversions = results.reduce((sum, result) => sum + result.conversions, 0);

  const ranked = [...results].sort((a, b) => b.conversionRate - a.conversionRate);
  const leader = ranked[0] ?? null;
  const challenger = leader && !leader.isControl ? leader : ranked.find((r) => !r.isControl) ?? null;

  const enoughTraffic = results.every((result) => result.visitors >= MIN_VISITORS_PER_VARIANT);
  const enoughConversions = results.every((result) => result.conversions >= MIN_CONVERSIONS_PER_VARIANT);
  const pValue = challenger?.pValue ?? null;
  const significant = Boolean(enoughTraffic && enoughConversions && pValue !== null && pValue < 0.05);

  let readiness: string;
  if (!totalVisitors) {
    readiness = "No traffic recorded yet.";
  } else if (!enoughTraffic) {
    const shortest = Math.min(...results.map((result) => result.visitors));
    readiness = `Needs at least ${MIN_VISITORS_PER_VARIANT} visitors per variant — the smallest arm has ${shortest}.`;
  } else if (!enoughConversions) {
    const fewest = Math.min(...results.map((result) => result.conversions));
    readiness = `Needs at least ${MIN_CONVERSIONS_PER_VARIANT} conversions per variant — the smallest arm has ${fewest}.`;
  } else if (pValue === null) {
    readiness = "Not enough variation to compute significance.";
  } else if (pValue >= 0.05) {
    readiness = `No statistically significant difference yet (p = ${pValue.toFixed(3)}). Keep running or accept the result as inconclusive.`;
  } else {
    readiness = `Statistically significant at p = ${pValue.toFixed(3)}.`;
  }

  return {
    variants: results,
    totalVisitors,
    totalConversions,
    leader,
    significant,
    readiness,
    minimumVisitorsPerVariant: MIN_VISITORS_PER_VARIANT,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export type ExperimentInput = {
  name: string;
  hypothesis?: string | null;
  testType: string;
  targetType: "page" | "product";
  pageId?: string | null;
  productId?: string | null;
  sectionId?: string | null;
  goal: string;
  variants: Array<{ id?: string; name: string; isControl?: boolean; weight: number; changes: Record<string, unknown> }>;
};

export async function listExperiments(ctx: ServiceContext) {
  authorize(ctx, "experiments:read");
  const experiments = await prisma.experiment.findMany({
    where: { storeId: ctx.storeId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { variants: true, _count: { select: { events: true } } },
  });

  return Promise.all(
    experiments.map(async (experiment) => ({
      ...experiment,
      results: await getExperimentResults(experiment.id),
    })),
  );
}

export async function getExperiment(ctx: ServiceContext, id: string) {
  authorize(ctx, "experiments:read");
  const experiment = await prisma.experiment.findFirst({
    where: { id, storeId: ctx.storeId },
    include: {
      variants: { orderBy: { name: "asc" } },
    },
  });
  if (!experiment) throw new NotFoundError("Experiment");

  const [results, page, product] = await Promise.all([
    getExperimentResults(id),
    experiment.pageId ? prisma.page.findUnique({ where: { id: experiment.pageId }, select: { id: true, title: true, slug: true, type: true } }) : null,
    experiment.productId ? prisma.product.findUnique({ where: { id: experiment.productId }, select: { id: true, title: true, slug: true } }) : null,
  ]);

  return { ...experiment, results, page, product };
}

function validateVariants(variants: ExperimentInput["variants"]) {
  if (variants.length < 2) throw new ValidationError("An experiment needs at least two variants.");
  if (variants.length > 6) throw new ValidationError("Up to six variants are supported.");
  const total = variants.reduce((sum, variant) => sum + variant.weight, 0);
  if (total !== 100) {
    throw new ValidationError(`Traffic allocation must total 100% — it currently totals ${total}%.`);
  }
}

export async function createExperiment(ctx: ServiceContext, input: ExperimentInput) {
  authorize(ctx, "experiments:write");
  validateVariants(input.variants);

  if (input.targetType === "page" && !input.pageId) {
    throw new ValidationError("Choose the page this experiment runs on.");
  }
  if (input.targetType === "product" && !input.productId) {
    throw new ValidationError("Choose the product this experiment runs on.");
  }

  const experiment = await prisma.experiment.create({
    data: {
      storeId: ctx.storeId,
      name: input.name,
      hypothesis: input.hypothesis ?? null,
      status: "DRAFT",
      testType: input.testType,
      targetType: input.targetType,
      pageId: input.pageId ?? null,
      productId: input.productId ?? null,
      sectionId: input.sectionId ?? null,
      goal: input.goal,
      variants: {
        create: input.variants.map((variant, index) => ({
          name: variant.name || String.fromCharCode(65 + index),
          isControl: variant.isControl ?? index === 0,
          weight: variant.weight,
          changes: variant.changes as Prisma.InputJsonValue,
        })),
      },
    },
    include: { variants: true },
  });

  await audit(ctx, "experiment.create", { type: "Experiment", id: experiment.id }, { name: experiment.name });
  return experiment;
}

export async function updateExperiment(ctx: ServiceContext, id: string, input: Partial<ExperimentInput>) {
  authorize(ctx, "experiments:write");
  const existing = await prisma.experiment.findFirst({ where: { id, storeId: ctx.storeId } });
  if (!existing) throw new NotFoundError("Experiment");

  if (input.variants) {
    validateVariants(input.variants);
    if (existing.status !== "DRAFT") {
      // Changing variant copy mid-flight would invalidate collected data.
      const changingSet = await prisma.experimentVariant.count({ where: { experimentId: id } });
      if (changingSet !== input.variants.length) {
        throw new ValidationError("Variants cannot be added or removed once an experiment has started.");
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.experiment.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.hypothesis !== undefined && { hypothesis: input.hypothesis }),
        ...(input.goal !== undefined && { goal: input.goal }),
        ...(input.testType !== undefined && { testType: input.testType }),
      },
    });

    if (input.variants) {
      for (const variant of input.variants) {
        if (variant.id) {
          await tx.experimentVariant.update({
            where: { id: variant.id },
            data: {
              name: variant.name,
              weight: variant.weight,
              changes: variant.changes as Prisma.InputJsonValue,
              isControl: variant.isControl ?? false,
            },
          });
        } else if (existing.status === "DRAFT") {
          await tx.experimentVariant.create({
            data: {
              experimentId: id,
              name: variant.name,
              weight: variant.weight,
              changes: variant.changes as Prisma.InputJsonValue,
              isControl: variant.isControl ?? false,
            },
          });
        }
      }
    }
  });

  await audit(ctx, "experiment.update", { type: "Experiment", id });
  return getExperiment(ctx, id);
}

export async function setExperimentStatus(ctx: ServiceContext, id: string, status: ExperimentStatus) {
  authorize(ctx, "experiments:write");
  const experiment = await prisma.experiment.findFirst({
    where: { id, storeId: ctx.storeId },
    include: { variants: true },
  });
  if (!experiment) throw new NotFoundError("Experiment");

  if (status === "RUNNING" && experiment.variants.length < 2) {
    throw new ValidationError("Add at least two variants before starting.");
  }
  if (status === "RUNNING" && experiment.status !== "RUNNING") {
    await assertCanStartExperiment(ctx);
  }

  const updated = await prisma.experiment.update({
    where: { id },
    data: {
      status,
      ...(status === "RUNNING" && !experiment.startedAt ? { startedAt: new Date() } : {}),
      ...(status === "COMPLETED" ? { endedAt: new Date() } : {}),
    },
  });

  if (status === "COMPLETED") {
    await prisma.notification.create({
      data: {
        storeId: ctx.storeId,
        type: "experiment_completed",
        title: `Experiment completed: ${experiment.name}`,
        body: "Review the results and choose a winner.",
        href: `/admin/experiments/${id}`,
      },
    });
  }

  await audit(ctx, `experiment.${status.toLowerCase()}`, { type: "Experiment", id });
  return updated;
}

/**
 * Declares a winner and, where the change is a simple field patch, writes it
 * onto the live page section or product so the improvement actually ships.
 */
export async function chooseWinner(ctx: ServiceContext, id: string, variantId: string, apply: boolean) {
  authorize(ctx, "experiments:write");
  const experiment = await prisma.experiment.findFirst({
    where: { id, storeId: ctx.storeId },
    include: { variants: true },
  });
  if (!experiment) throw new NotFoundError("Experiment");

  const variant = experiment.variants.find((v) => v.id === variantId);
  if (!variant) throw new ValidationError("That variant is not part of this experiment.");

  await prisma.experiment.update({
    where: { id },
    data: { winnerVariantId: variantId, status: "COMPLETED", endedAt: new Date() },
  });

  let applied = false;
  const changes = (variant.changes ?? {}) as Record<string, unknown>;

  if (apply && Object.keys(changes).length) {
    if (experiment.targetType === "page" && experiment.sectionId) {
      const section = await prisma.pageSection.findUnique({ where: { id: experiment.sectionId } });
      if (section) {
        await prisma.pageSection.update({
          where: { id: section.id },
          data: {
            config: { ...((section.config ?? {}) as Record<string, unknown>), ...changes } as Prisma.InputJsonValue,
          },
        });
        applied = true;
      }
    } else if (experiment.targetType === "product" && experiment.productId) {
      const data: Prisma.ProductUpdateInput = {};
      if (typeof changes.title === "string") data.title = changes.title;
      if (typeof changes.description === "string") data.description = changes.description;
      if (Object.keys(data).length) {
        await prisma.product.update({ where: { id: experiment.productId }, data });
        applied = true;
      }
    }
  }

  await audit(ctx, "experiment.winner", { type: "Experiment", id }, { variantId, applied });
  return { applied, variant };
}

export async function deleteExperiment(ctx: ServiceContext, id: string) {
  authorize(ctx, "experiments:write");
  const result = await prisma.experiment.deleteMany({ where: { id, storeId: ctx.storeId } });
  if (!result.count) throw new NotFoundError("Experiment");
  await audit(ctx, "experiment.delete", { type: "Experiment", id });
  return true;
}
