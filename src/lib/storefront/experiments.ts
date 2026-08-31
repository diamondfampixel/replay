import "server-only";
import { getAssignmentsFor, recordExperimentEvent, type VariantAssignment } from "@/lib/services/experiments";

export type { VariantAssignment };

/**
 * Resolves which variants this visitor sees and records the impressions.
 *
 * Impressions are written on the render that showed them, so an experiment's
 * visitor count is the number of people who actually saw a variant rather than
 * a count of requests.
 */
export async function resolveExperiments(
  storeId: string,
  target: { pageId?: string | null; productId?: string | null },
  sessionId: string,
): Promise<VariantAssignment[]> {
  if (!sessionId) return [];

  const assignments = await getAssignmentsFor(storeId, target, sessionId);

  // Fire and forget — a failure here must never break a storefront render.
  void Promise.all(
    assignments.map((assignment) =>
      recordExperimentEvent({
        experimentId: assignment.experimentId,
        variantId: assignment.variantId,
        sessionId,
        type: "impression",
      }),
    ),
  ).catch(() => undefined);

  return assignments;
}

/**
 * Merges a variant's changes into a section config. Only keys the variant
 * actually declares are overridden.
 */
export function applyVariantToConfig(
  config: Record<string, unknown>,
  assignments: VariantAssignment[],
  sectionId: string,
  experimentSectionIds: Map<string, string | null>,
): Record<string, unknown> {
  let result = config;
  for (const assignment of assignments) {
    if (experimentSectionIds.get(assignment.experimentId) !== sectionId) continue;
    result = { ...result, ...assignment.changes };
  }
  return result;
}
