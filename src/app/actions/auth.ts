"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  generateToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "@/lib/auth";
import { createSession, destroySession, getSessionUser } from "@/lib/session";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth";
import { fail, fromZodError, guard, ok, type ActionResult } from "@/lib/action-result";
import { sendVerification } from "@/lib/services/verification";
import { isValidInvite, signupIsOpen } from "@/lib/launch";
import {
  isPlatformEmailConfigured, passwordResetEmail, sendPlatformEmail,
} from "@/lib/platform-email";
import { rateLimit } from "@/lib/rate-limit";

async function requestMeta() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent") ?? undefined,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local",
  };
}

export async function signupAction(formData: FormData): Promise<ActionResult<{ redirect: string }>> {
  return guard(async () => {
    const meta = await requestMeta();
    const limit = await rateLimit(`signup:${meta.ip}`, { limit: 10, windowMs: 60 * 60_000 });
    if (!limit.ok) return fail("Too many attempts. Please try again later.");

    const parsed = signupSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    // During the gated stages, an account needs an invite code. Nothing else
    // changes — existing accounts sign in normally, no route disappears, and
    // flipping LAUNCH_STAGE to "public" reopens signup with no deploy of code.
    if (!signupIsOpen()) {
      const invite = String(formData.get("inviteCode") ?? "");
      if (!isValidInvite(invite)) {
        return fail(
          "Halyard is in early access. Join the waitlist on the homepage, or enter the invite code you were given.",
          { inviteCode: "Invalid or missing invite code." },
        );
      }
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return fail("An account with that email already exists.", {
        email: "An account with that email already exists.",
      });
    }

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });

    // With no platform email provider there is no way to deliver the link, so
    // the account verifies on creation rather than being stuck forever.
    const verification = await sendVerification(user);
    if (verification === "not-configured") {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    await createSession(user.id, meta);
    return ok({ redirect: "/onboarding" });
  });
}

/** A real scrypt hash, verified when no account matches so timing cannot reveal which emails exist. */
const DUMMY_HASH = hashPassword("halyard-dummy-password-for-timing");

export async function loginAction(formData: FormData): Promise<ActionResult<{ redirect: string }>> {
  return guard(async () => {
    const meta = await requestMeta();
    const limit = await rateLimit(`login:${meta.ip}`, { limit: 20, windowMs: 15 * 60_000 });
    if (!limit.ok) {
      return fail(`Too many sign-in attempts. Try again in ${limit.retryAfterSeconds}s.`);
    }

    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    // A second window per account: one address cannot be stuffed from many IPs.
    const accountLimit = await rateLimit(`login-account:${parsed.data.email.toLowerCase()}`, { limit: 10, windowMs: 15 * 60_000 });
    if (!accountLimit.ok) {
      return fail(`Too many sign-in attempts for this account. Try again in ${accountLimit.retryAfterSeconds}s.`);
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    // Always run the hash so a missing account takes as long as a wrong password.
    const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await DUMMY_HASH));
    if (!user || !valid) return fail("Incorrect email or password.");

    await createSession(user.id, meta);

    const membership = await prisma.membership.findFirst({ where: { userId: user.id } });
    return ok({ redirect: membership ? "/admin" : "/onboarding" });
  });
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function forgotPasswordAction(
  formData: FormData,
): Promise<ActionResult<{ devToken?: string }>> {
  return guard(async () => {
    const meta = await requestMeta();
    const limit = await rateLimit(`forgot:${meta.ip}`, { limit: 5, windowMs: 15 * 60_000 });
    if (!limit.ok) return fail("Too many requests. Please try again later.");

    const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
    if (!parsed.success) return fromZodError(parsed.error);

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    // Always report success — never reveal whether an account exists.
    if (!user) return ok({});

    const token = generateToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });

    if (isPlatformEmailConfigured()) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const email = passwordResetEmail(`${appUrl}/reset-password?token=${token}`);
      await sendPlatformEmail({ to: user.email, ...email });
      return ok({});
    }

    // No email provider is configured. In development we surface the link
    // directly so the flow is genuinely testable; in production it is
    // withheld — a reset link nobody can receive should not exist in a
    // response body.
    if (process.env.NODE_ENV !== "production") {
      return ok({ devToken: token });
    }
    return ok({});
  });
}

export async function resetPasswordAction(formData: FormData): Promise<ActionResult<null>> {
  return guard(async () => {
    const parsed = resetPasswordSchema.safeParse({
      token: formData.get("token"),
      password: formData.get("password"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const record = await prisma.passwordResetToken.findUnique({
      where: { token: hashToken(parsed.data.token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return fail("This reset link is invalid or has expired.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(parsed.data.password) },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Sign out every existing session after a password change.
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    return ok(null, "Password updated. You can sign in now.");
  });
}

export async function currentUserAction() {
  return getSessionUser();
}

export async function resendVerificationAction(): Promise<ActionResult<null>> {
  return guard(async () => {
    const user = await getSessionUser();
    if (!user) return fail("Sign in first.");

    const limit = await rateLimit(`verify:${user.id}`, { limit: 3, windowMs: 15 * 60_000 });
    if (!limit.ok) return fail("A link was just sent. Check your inbox, and spam, before requesting another.");

    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (record.emailVerifiedAt) return ok(null, "Your email is already confirmed.");

    const outcome = await sendVerification(record);
    if (outcome === "sent") return ok(null, `Confirmation link sent to ${record.email}`);
    return fail("The email could not be sent right now. Try again in a few minutes.");
  });
}
