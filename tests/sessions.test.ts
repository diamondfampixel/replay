import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { setTestCookie, clearTestCookies } from "./setup";
import { revokeOtherSessions } from "@/lib/session";
import { hashPassword } from "@/lib/auth";

const SESSION_COOKIE = "halyard_session";

function hashToken(token: string) {
  return createHash("sha256").update(`${process.env.AUTH_SECRET ?? ""}:${token}`).digest("hex");
}

let organizationId: string;
let userId: string;

async function makeSession() {
  const token = randomBytes(24).toString("base64url");
  await testDb.session.create({
    data: { userId, token: hashToken(token), expiresAt: new Date(Date.now() + 864e5) },
  });
  return token;
}

beforeAll(async () => {
  const setup = await createTestStore("sessions");
  organizationId = setup.organization.id;
  userId = setup.user.id;
});

afterAll(async () => {
  await cleanupTestStore(organizationId, userId);
});

beforeEach(async () => {
  clearTestCookies();
  await testDb.session.deleteMany({ where: { userId } });
});

describe("revokeOtherSessions", () => {
  it("drops every other session but keeps the caller signed in", async () => {
    const mine = await makeSession();
    await makeSession();
    await makeSession();
    expect(await testDb.session.count({ where: { userId } })).toBe(3);

    setTestCookie(SESSION_COOKIE, mine);
    const revoked = await revokeOtherSessions(userId);

    expect(revoked).toBe(2);
    const remaining = await testDb.session.findMany({ where: { userId } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].token).toBe(hashToken(mine));
  });

  it("drops all of them when there is no calling session", async () => {
    await makeSession();
    await makeSession();

    const revoked = await revokeOtherSessions(userId);

    expect(revoked).toBe(2);
    expect(await testDb.session.count({ where: { userId } })).toBe(0);
  });

  it("leaves other users' sessions alone", async () => {
    const other = await createTestStore("sessions-other");
    await testDb.session.create({
      data: {
        userId: other.user.id,
        token: hashToken(randomBytes(24).toString("base64url")),
        expiresAt: new Date(Date.now() + 864e5),
      },
    });
    await makeSession();

    await revokeOtherSessions(userId);

    expect(await testDb.session.count({ where: { userId: other.user.id } })).toBe(1);
    await testDb.session.deleteMany({ where: { userId: other.user.id } });
    await cleanupTestStore(other.organization.id, other.user.id);
  });
});

describe("a password reset ends existing sessions", () => {
  it("resetPasswordAction deletes every session for the user", async () => {
    const { resetPasswordAction } = await import("@/app/actions/auth");
    await makeSession();
    await makeSession();

    const token = randomBytes(24).toString("base64url");
    await testDb.passwordResetToken.create({
      data: {
        userId,
        token: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });

    const form = new FormData();
    form.set("token", token);
    form.set("password", "a-new-password-1");
    const result = await resetPasswordAction(form);

    expect(result.ok).toBe(true);
    expect(await testDb.session.count({ where: { userId } })).toBe(0);
  });

  it("refuses a reset token that has already been used", async () => {
    const { resetPasswordAction } = await import("@/app/actions/auth");
    const token = randomBytes(24).toString("base64url");
    await testDb.passwordResetToken.create({
      data: {
        userId,
        token: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60_000),
        usedAt: new Date(),
      },
    });

    const form = new FormData();
    form.set("token", token);
    form.set("password", "another-password-1");
    expect((await resetPasswordAction(form)).ok).toBe(false);
  });

  it("refuses an expired reset token", async () => {
    const { resetPasswordAction } = await import("@/app/actions/auth");
    const token = randomBytes(24).toString("base64url");
    await testDb.passwordResetToken.create({
      data: {
        userId,
        token: hashToken(token),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const form = new FormData();
    form.set("token", token);
    form.set("password", "another-password-2");
    expect((await resetPasswordAction(form)).ok).toBe(false);
  });
});

describe("password reset does not reveal who has an account", () => {
  it("reports success for an address with no account", async () => {
    const { forgotPasswordAction } = await import("@/app/actions/auth");
    const form = new FormData();
    form.set("email", `nobody-${Date.now()}@example.test`);
    expect((await forgotPasswordAction(form)).ok).toBe(true);
  });
});

// Restore the seeded password so later runs of this file behave the same.
afterAll(async () => {
  await testDb.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword("password123") },
  });
});

describe("email verification", () => {
  it("confirms the account with a genuine token, exactly once", async () => {
    const { verifyEmailToken } = await import("@/lib/services/verification");
    const token = randomBytes(24).toString("base64url");
    await testDb.user.update({ where: { id: userId }, data: { emailVerifiedAt: null } });
    await testDb.emailVerificationToken.create({
      data: { userId, token: hashToken(token), expiresAt: new Date(Date.now() + 60_000) },
    });

    expect(await verifyEmailToken(token)).toBe(true);
    const user = await testDb.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.emailVerifiedAt).not.toBeNull();

    // Replay of the same token fails.
    expect(await verifyEmailToken(token)).toBe(false);
  });

  it("rejects expired and invented tokens", async () => {
    const { verifyEmailToken } = await import("@/lib/services/verification");
    const stale = randomBytes(24).toString("base64url");
    await testDb.emailVerificationToken.create({
      data: { userId, token: hashToken(stale), expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await verifyEmailToken(stale)).toBe(false);
    expect(await verifyEmailToken("not-a-real-token")).toBe(false);
  });

  it("signup verifies immediately when no platform email exists to send with", async () => {
    const { signupAction } = await import("@/app/actions/auth");
    const form = new FormData();
    const email = `verify-${Date.now()}@example.test`;
    form.set("name", "Verify Test");
    form.set("email", email);
    form.set("password", "a-password-123");
    const result = await signupAction(form);
    expect(result.ok).toBe(true);

    const user = await testDb.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerifiedAt).not.toBeNull();
    await testDb.session.deleteMany({ where: { userId: user.id } });
    await testDb.user.delete({ where: { id: user.id } });
  });
});
