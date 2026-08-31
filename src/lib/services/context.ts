import "server-only";
import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/client";
import { assertCan, type Capability } from "@/lib/permissions";
import { requireContext } from "@/lib/session";

/**
 * Everything a service call needs: which tenant, who is asking, and whether the
 * change came from a person or the assistant. Server actions build one from the
 * session; AI tools build one from the same session plus actor "ai".
 */
export type ServiceContext = {
  storeId: string;
  organizationId: string;
  userId: string | null;
  role: Role;
  actor: "user" | "ai" | "system";
  /** The prompt that triggered an AI action, for the audit trail. */
  prompt?: string;
};

export async function serviceContext(
  overrides: Partial<Pick<ServiceContext, "actor" | "prompt">> = {},
): Promise<ServiceContext> {
  const ctx = await requireContext();
  return {
    storeId: ctx.storeId,
    organizationId: ctx.organizationId,
    userId: ctx.user.id,
    role: ctx.role,
    actor: overrides.actor ?? "user",
    prompt: overrides.prompt,
  };
}

export function authorize(ctx: ServiceContext, capability: Capability) {
  assertCan(ctx.role, capability);
}

/** Writes an audit record. Failures here never break the operation. */
export async function audit(
  ctx: ServiceContext,
  action: string,
  entity?: { type: string; id: string },
  metadata?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        actor: ctx.actor,
        action,
        entityType: entity?.type,
        entityId: entity?.id,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record", action, error);
  }
}

export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found.`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  readonly fieldErrors?: Record<string, string>;
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/** Ensures a slug is unique within a store, appending -2, -3, … as needed. */
export async function uniqueStoreSlug(
  table: "product" | "collection" | "category" | "page",
  storeId: string,
  desired: string,
  excludeId?: string,
): Promise<string> {
  const root = desired || "item";
  let candidate = root;
  let n = 1;
  while (true) {
    const where = { storeId, slug: candidate } as never;
    const existing =
      table === "product"
        ? await prisma.product.findFirst({ where, select: { id: true } })
        : table === "collection"
          ? await prisma.collection.findFirst({ where, select: { id: true } })
          : table === "category"
            ? await prisma.category.findFirst({ where, select: { id: true } })
            : await prisma.page.findFirst({ where, select: { id: true } });

    if (!existing || existing.id === excludeId) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}
