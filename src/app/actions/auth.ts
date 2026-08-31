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
    const limit = rateLimit(`signup:${meta.ip}`, { limit: 10, windowMs: 60 * 60_000 });
    if (!limit.ok) return fail("Too many attempts. Please try again later.");

    const parsed = signupSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

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

    await createSession(user.id, meta);
    return ok({ redirect: "/onboarding" });
  });
}

export async function loginAction(formData: FormData): Promise<ActionResult<{ redirect: string }>> {
  return guard(async () => {
    const meta = await requestMeta();
    const limit = rateLimit(`login:${meta.ip}`, { limit: 20, windowMs: 15 * 60_000 });
    if (!limit.ok) {
      return fail(`Too many sign-in attempts. Try again in ${limit.retryAfterSeconds}s.`);
    }

    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
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
    const limit = rateLimit(`forgot:${meta.ip}`, { limit: 5, windowMs: 15 * 60_000 });
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

    // No email provider is configured by default. In development we surface the
    // link directly so the flow is genuinely testable; in production this is
    // withheld until an email integration is connected.
    if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) {
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
