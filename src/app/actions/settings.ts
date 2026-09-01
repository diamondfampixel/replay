"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, serviceContext } from "@/lib/services/context";
import { requireContext, revokeOtherSessions } from "@/lib/session";
import { fail, fromZodError, guard, ok } from "@/lib/action-result";
import { assertCanAddTeamMember } from "@/lib/services/billing";
import { assertCan } from "@/lib/permissions";
import { hashPassword, verifyPassword } from "@/lib/auth";
import type { Role } from "@/generated/prisma/client";

const generalSchema = z.object({
  name: z.string().trim().min(1, "Store name is required").max(120),
  description: z.string().trim().max(600).optional(),
  contactEmail: z.string().trim().email("Enter a valid email").or(z.literal("")).optional(),
  supportPhone: z.string().trim().max(40).optional(),
  currency: z.string().trim().length(3),
  timezone: z.string().trim().min(1).max(60),
  industry: z.string().trim().max(80).optional(),
  targetCustomer: z.string().trim().max(300).optional(),
  brandPersonality: z.string().trim().max(200).optional(),
});

export async function updateGeneralSettingsAction(input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    assertCan(ctx.role, "settings:write");
    const parsed = generalSchema.safeParse(input);
    if (!parsed.success) return fromZodError(parsed.error);

    await prisma.store.update({
      where: { id: ctx.storeId },
      data: {
        ...parsed.data,
        contactEmail: parsed.data.contactEmail || null,
        supportPhone: parsed.data.supportPhone || null,
      },
    });
    await audit(ctx, "settings.general", { type: "Store", id: ctx.storeId });
    revalidatePath("/admin/settings");
    revalidatePath("/admin", "layout");
    return ok(null, "Settings saved");
  });
}

const brandSchema = z.object({
  logoUrl: z.string().trim().max(1000).nullable().optional(),
  primaryColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex colour"),
  secondaryColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex colour"),
  fontHeading: z.string().trim().max(60),
  fontBody: z.string().trim().max(60),
});

export async function updateBrandSettingsAction(input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    assertCan(ctx.role, "settings:write");
    const parsed = brandSchema.safeParse(input);
    if (!parsed.success) return fromZodError(parsed.error);

    await prisma.store.update({ where: { id: ctx.storeId }, data: parsed.data });
    await audit(ctx, "settings.brand", { type: "Store", id: ctx.storeId });

    const store = await prisma.store.findUniqueOrThrow({
      where: { id: ctx.storeId },
      select: { slug: true },
    });
    revalidatePath("/admin/settings/brand");
    revalidatePath(`/s/${store.slug}`, "layout");
    return ok(null, "Brand saved");
  });
}

const storeSettingsSchema = z.object({
  freeShippingThreshold: z.number().min(0).nullable().optional(),
  taxEnabled: z.boolean().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  taxIncluded: z.boolean().optional(),
  notifyNewOrder: z.boolean().optional(),
  notifyLowInventory: z.boolean().optional(),
  lowInventoryThreshold: z.number().int().min(0).max(1000).optional(),
  notifyExperimentDone: z.boolean().optional(),
  aiConfirmHighImpact: z.boolean().optional(),
  aiTone: z.string().max(40).optional(),
  aiAutoApplyLowRisk: z.boolean().optional(),
  checkoutMode: z.enum(["simulated", "stripe"]).optional(),
  shippingZones: z.array(z.object({
    name: z.string().max(80),
    countries: z.array(z.string().max(2)).max(50),
    rate: z.number().min(0),
  })).max(20).optional(),
});

export async function updateStoreSettingsAction(input: unknown) {
  return guard(async () => {
    const ctx = await serviceContext();
    assertCan(ctx.role, "settings:write");
    const parsed = storeSettingsSchema.safeParse(input);
    if (!parsed.success) return fromZodError(parsed.error);

    // Switching to Stripe is only allowed when Stripe is genuinely connected.
    if (parsed.data.checkoutMode === "stripe") {
      const integration = await prisma.integration.findUnique({
        where: { storeId_provider: { storeId: ctx.storeId, provider: "stripe" } },
      });
      const hasEnvKey = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
      if (integration?.status !== "CONNECTED" && !hasEnvKey) {
        return fail("Connect Stripe under Integrations before switching checkout to Stripe mode.");
      }
    }

    const { shippingZones, ...rest } = parsed.data;
    await prisma.storeSettings.upsert({
      where: { storeId: ctx.storeId },
      create: {
        storeId: ctx.storeId,
        ...rest,
        ...(shippingZones ? { shippingZones } : {}),
      },
      update: {
        ...rest,
        ...(shippingZones ? { shippingZones } : {}),
      },
    });
    await audit(ctx, "settings.store", { type: "Store", id: ctx.storeId }, { keys: Object.keys(parsed.data) });
    revalidatePath("/admin/settings", "layout");
    return ok(null, "Settings saved");
  });
}

// -- team -------------------------------------------------------------------

export async function inviteMemberAction(email: string, role: Role) {
  return guard(async () => {
    const ctx = await serviceContext();
    assertCan(ctx.role, "team:manage");
    await assertCanAddTeamMember(ctx);

    const normalised = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalised } });
    if (!user) {
      return fail(
        "No Halyard account exists for that email. Ask them to sign up first — email invitations are not implemented in this build.",
      );
    }

    if (role === "OWNER" && ctx.role !== "OWNER") {
      return fail("Only an owner can add another owner.");
    }

    const existing = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: ctx.organizationId } },
    });
    if (existing) return fail("That person is already on your team.");

    await prisma.membership.create({
      data: { userId: user.id, organizationId: ctx.organizationId, role },
    });
    await audit(ctx, "team.add", { type: "User", id: user.id }, { role });
    revalidatePath("/admin/settings/team");
    return ok(null, `${user.name} added as ${role.toLowerCase()}`);
  });
}

export async function updateMemberRoleAction(membershipId: string, role: Role) {
  return guard(async () => {
    const ctx = await serviceContext();
    assertCan(ctx.role, "team:manage");

    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId: ctx.organizationId },
    });
    if (!membership) return fail("That team member no longer exists.");

    // Owner and admin differ by a single capability, so granting the owner role
    // is what separates them. Without these three rules an admin could promote
    // themselves and then remove the real owner.
    if (membership.userId === ctx.userId) {
      return fail("You cannot change your own role. Ask another owner to do it.");
    }
    if (role === "OWNER" && ctx.role !== "OWNER") {
      return fail("Only an owner can grant the owner role.");
    }
    if (membership.role === "OWNER" && ctx.role !== "OWNER") {
      return fail("Only an owner can change another owner's role.");
    }

    if (membership.role === "OWNER") {
      const owners = await prisma.membership.count({
        where: { organizationId: ctx.organizationId, role: "OWNER" },
      });
      if (owners <= 1) return fail("An organization needs at least one owner.");
    }

    await prisma.membership.update({ where: { id: membershipId }, data: { role } });
    await audit(ctx, "team.role", { type: "Membership", id: membershipId }, { role });
    revalidatePath("/admin/settings/team");
    return ok(null, "Role updated");
  });
}

export async function removeMemberAction(membershipId: string) {
  return guard(async () => {
    const ctx = await serviceContext();
    assertCan(ctx.role, "team:manage");

    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId: ctx.organizationId },
    });
    if (!membership) return fail("That team member no longer exists.");
    if (membership.userId === ctx.userId) return fail("You cannot remove yourself.");
    if (membership.role === "OWNER" && ctx.role !== "OWNER") {
      return fail("Only an owner can remove another owner.");
    }

    if (membership.role === "OWNER") {
      const owners = await prisma.membership.count({
        where: { organizationId: ctx.organizationId, role: "OWNER" },
      });
      if (owners <= 1) return fail("An organization needs at least one owner.");
    }

    await prisma.membership.delete({ where: { id: membershipId } });
    await audit(ctx, "team.remove", { type: "Membership", id: membershipId });
    revalidatePath("/admin/settings/team");
    return ok(null, "Team member removed");
  });
}

// -- profile ----------------------------------------------------------------

export async function updateProfileAction(name: string) {
  return guard(async () => {
    const ctx = await requireContext();
    if (!name.trim()) return fail("Enter your name.");
    await prisma.user.update({ where: { id: ctx.user.id }, data: { name: name.trim() } });
    revalidatePath("/admin", "layout");
    return ok(null, "Profile saved");
  });
}

export async function changePasswordAction(current: string, next: string) {
  return guard(async () => {
    const ctx = await requireContext();
    if (next.length < 8) return fail("New password must be at least 8 characters.");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
    if (!(await verifyPassword(current, user.passwordHash))) {
      return fail("Your current password is incorrect.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(next) },
    });

    // Changing a password is how someone locks out a session they no longer
    // trust, so the old ones go with it. The forgot-password flow already does
    // this; the two paths should not differ.
    const revoked = await revokeOtherSessions(user.id);

    const sctx = await serviceContext();
    await audit(sctx, "user.password", { type: "User", id: user.id }, { revokedSessions: revoked });
    return ok(
      null,
      revoked > 0
        ? `Password changed. ${revoked} other session${revoked === 1 ? "" : "s"} signed out.`
        : "Password changed",
    );
  });
}

// -- demo data --------------------------------------------------------------

export async function purgeDemoDataAction() {
  return guard(async () => {
    const ctx = await serviceContext();
    assertCan(ctx.role, "settings:write");

    const removed = await prisma.$transaction(async (tx) => {
      const [orders, products, customers, reviews, events, daily, experiments, campaigns, subscribers, discounts, media] =
        await Promise.all([
          tx.order.deleteMany({ where: { storeId: ctx.storeId, isDemo: true } }),
          tx.product.deleteMany({ where: { storeId: ctx.storeId, isDemo: true } }),
          tx.customer.deleteMany({ where: { storeId: ctx.storeId, isDemo: true } }),
          tx.review.deleteMany({ where: { storeId: ctx.storeId, isDemo: true } }),
          tx.analyticsEvent.deleteMany({ where: { storeId: ctx.storeId, isDemo: true } }),
          tx.analyticsDaily.deleteMany({ where: { storeId: ctx.storeId, isDemo: true } }),
          tx.experiment.deleteMany({ where: { storeId: ctx.storeId, isDemo: true } }),
          tx.emailCampaign.deleteMany({ where: { storeId: ctx.storeId, isDemo: true } }),
          tx.emailSubscriber.deleteMany({ where: { storeId: ctx.storeId, isDemo: true } }),
          tx.discount.deleteMany({ where: { storeId: ctx.storeId, isDemo: true } }),
          tx.mediaAsset.deleteMany({ where: { storeId: ctx.storeId, isDemo: true } }),
        ]);
      await tx.store.update({ where: { id: ctx.storeId }, data: { isDemo: false } });
      return {
        orders: orders.count, products: products.count, customers: customers.count,
        reviews: reviews.count, events: events.count, dailyStats: daily.count,
        experiments: experiments.count, campaigns: campaigns.count,
        subscribers: subscribers.count, discounts: discounts.count, media: media.count,
      };
    });

    await audit(ctx, "settings.purgeDemoData", { type: "Store", id: ctx.storeId }, removed);
    revalidatePath("/admin", "layout");
    const total = Object.values(removed).reduce((sum, count) => sum + count, 0);
    return ok(removed, `Removed ${total} seeded records.`);
  });
}
