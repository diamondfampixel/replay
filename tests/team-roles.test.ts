import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { can } from "@/lib/permissions";
import type { ServiceContext } from "@/lib/services/context";
import type { Role } from "@/generated/prisma/client";

/**
 * OWNER and ADMIN differ by exactly one capability, so anything that lets an
 * ADMIN reach the OWNER role erases the distinction entirely — and an admin who
 * can promote themselves can then remove the real owner.
 */

let ctx: ServiceContext;
let organizationId: string;
let ownerUserId: string;

/** The role the mocked session reports; each test sets it. */
let actingRole: Role = "OWNER";
let actingUserId = "";

vi.mock("@/lib/services/context", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/services/context")>("@/lib/services/context");
  return {
    ...actual,
    serviceContext: async () => ({ ...ctx, role: actingRole, userId: actingUserId }),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

async function addMember(email: string, role: Role) {
  const user = await testDb.user.create({
    data: { email, name: email.split("@")[0], passwordHash: "x" },
  });
  const membership = await testDb.membership.create({
    data: { userId: user.id, organizationId, role },
  });
  return { user, membership };
}

beforeAll(async () => {
  const setup = await createTestStore("team-roles");
  ctx = setup.ctx;
  organizationId = setup.organization.id;
  ownerUserId = setup.user.id;
  actingUserId = ownerUserId;
});

afterAll(async () => {
  await cleanupTestStore(organizationId, ownerUserId);
});

describe("owner and admin boundary", () => {
  it("admin is denied only billing:manage", () => {
    expect(can("ADMIN", "billing:manage")).toBe(false);
    expect(can("OWNER", "billing:manage")).toBe(true);
    // Which is why team:manage alone must not be enough to reach OWNER.
    expect(can("ADMIN", "team:manage")).toBe(true);
  });
});

describe("updateMemberRoleAction", () => {
  it("refuses to let anyone change their own role", async () => {
    const { updateMemberRoleAction } = await import("@/app/actions/settings");
    const admin = await addMember(`admin-self-${Date.now()}@example.test`, "ADMIN");

    actingRole = "ADMIN";
    actingUserId = admin.user.id;
    const result = await updateMemberRoleAction(admin.membership.id, "OWNER");

    expect(result.ok).toBe(false);
    const row = await testDb.membership.findUniqueOrThrow({ where: { id: admin.membership.id } });
    expect(row.role).toBe("ADMIN");
  });

  it("refuses to let an admin grant the owner role to someone else", async () => {
    const { updateMemberRoleAction } = await import("@/app/actions/settings");
    const admin = await addMember(`admin-grant-${Date.now()}@example.test`, "ADMIN");
    const target = await addMember(`target-${Date.now()}@example.test`, "SUPPORT");

    actingRole = "ADMIN";
    actingUserId = admin.user.id;
    const result = await updateMemberRoleAction(target.membership.id, "OWNER");

    expect(result.ok).toBe(false);
    const row = await testDb.membership.findUniqueOrThrow({ where: { id: target.membership.id } });
    expect(row.role).toBe("SUPPORT");
  });

  it("refuses to let an admin demote an owner", async () => {
    const { updateMemberRoleAction } = await import("@/app/actions/settings");
    const admin = await addMember(`admin-demote-${Date.now()}@example.test`, "ADMIN");
    const secondOwner = await addMember(`owner2-${Date.now()}@example.test`, "OWNER");

    actingRole = "ADMIN";
    actingUserId = admin.user.id;
    const result = await updateMemberRoleAction(secondOwner.membership.id, "SUPPORT");

    expect(result.ok).toBe(false);
    const row = await testDb.membership.findUniqueOrThrow({
      where: { id: secondOwner.membership.id },
    });
    expect(row.role).toBe("OWNER");
  });

  it("still lets an owner manage roles, and an admin manage non-owners", async () => {
    const { updateMemberRoleAction } = await import("@/app/actions/settings");
    const member = await addMember(`member-${Date.now()}@example.test`, "SUPPORT");

    actingRole = "ADMIN";
    actingUserId = (await addMember(`admin-ok-${Date.now()}@example.test`, "ADMIN")).user.id;
    expect((await updateMemberRoleAction(member.membership.id, "MARKETING")).ok).toBe(true);

    actingRole = "OWNER";
    actingUserId = ownerUserId;
    expect((await updateMemberRoleAction(member.membership.id, "OWNER")).ok).toBe(true);
    const row = await testDb.membership.findUniqueOrThrow({ where: { id: member.membership.id } });
    expect(row.role).toBe("OWNER");
  });
});

describe("removeMemberAction", () => {
  it("refuses to let an admin remove an owner", async () => {
    const { removeMemberAction } = await import("@/app/actions/settings");
    const admin = await addMember(`admin-remove-${Date.now()}@example.test`, "ADMIN");
    const owner = await addMember(`owner-victim-${Date.now()}@example.test`, "OWNER");

    actingRole = "ADMIN";
    actingUserId = admin.user.id;
    const result = await removeMemberAction(owner.membership.id);

    expect(result.ok).toBe(false);
    expect(
      await testDb.membership.findUnique({ where: { id: owner.membership.id } }),
    ).not.toBeNull();
  });
});

describe("inviteMemberAction", () => {
  it("refuses to let an admin add a new owner", async () => {
    const { inviteMemberAction } = await import("@/app/actions/settings");
    const admin = await addMember(`admin-invite-${Date.now()}@example.test`, "ADMIN");
    const outsiderEmail = `outsider-${Date.now()}@example.test`;
    await testDb.user.create({
      data: { email: outsiderEmail, name: "Outsider", passwordHash: "x" },
    });

    actingRole = "ADMIN";
    actingUserId = admin.user.id;
    const result = await inviteMemberAction(outsiderEmail, "OWNER");

    expect(result.ok).toBe(false);
  });
});
