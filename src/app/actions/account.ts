"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireContext, destroySession } from "@/lib/session";
import { verifyPassword } from "@/lib/auth";
import { fail, guard, ok } from "@/lib/action-result";

/**
 * Deletes the organization and everything in it — stores, catalog, orders,
 * customers, analytics, AI history. Every relation cascades from Organization,
 * so this is one delete, and it is genuinely irreversible.
 */
export async function deleteOrganizationAction(confirmName: string) {
  const ctx = await requireContext();
  const result = await guard(async () => {
    if (ctx.role !== "OWNER") return fail("Only an owner can delete the organization.");

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
    });
    if (confirmName.trim() !== org.name) {
      return fail(`Type the organization name exactly — "${org.name}" — to confirm.`);
    }
    if (org.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY?.trim()) {
      return fail("Cancel the paid subscription under Manage billing first, so the charge stops.");
    }

    await prisma.organization.delete({ where: { id: org.id } });
    return ok(null);
  });

  if (!result.ok) return result;

  // With the organization gone the session context is meaningless.
  const remaining = await prisma.membership.count({ where: { userId: ctx.user.id } });
  if (remaining === 0) {
    await destroySession();
    redirect("/signup?deleted=1");
  }
  redirect("/admin");
}

/**
 * Deletes the signed-in user's account. Organizations they solely occupy go
 * with them; an organization where other people still work must change owner
 * first, so a team is never orphaned by one person leaving.
 */
export async function deleteAccountAction(password: string) {
  const ctx = await requireContext();
  const result = await guard(async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
    if (!(await verifyPassword(password, user.passwordHash))) {
      return fail("Your password is incorrect.");
    }

    const ownerships = await prisma.membership.findMany({
      where: { userId: user.id, role: "OWNER" },
      include: { organization: { include: { _count: { select: { memberships: true } } } } },
    });

    const shared = ownerships.filter((m) => m.organization._count.memberships > 1);
    if (shared.length) {
      return fail(
        `Transfer ownership of ${shared.map((m) => m.organization.name).join(", ")} first — other people still work there.`,
      );
    }

    if (process.env.STRIPE_SECRET_KEY?.trim()) {
      const paying = ownerships.find((m) => m.organization.stripeSubscriptionId);
      if (paying) {
        return fail(
          `Cancel the paid subscription for ${paying.organization.name} under Manage billing first.`,
        );
      }
    }

    await prisma.$transaction([
      // Sole-member organizations go with the account.
      prisma.organization.deleteMany({ where: { id: { in: ownerships.map((m) => m.organizationId) } } }),
      prisma.membership.deleteMany({ where: { userId: user.id } }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);
    return ok(null);
  });

  if (!result.ok) return result;
  await destroySession().catch(() => undefined);
  redirect("/?account-deleted=1");
}
