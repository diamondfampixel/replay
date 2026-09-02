import "server-only";
import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/auth";
import {
  isPlatformEmailConfigured, sendPlatformEmail, verificationEmail,
} from "@/lib/platform-email";

const TOKEN_TTL_MS = 24 * 60 * 60_000;

/**
 * Issues a verification token and emails the link. Returns "sent",
 * "not-configured" (no platform email — callers decide what that means), or
 * "failed" (provider errored; already reported).
 */
export async function sendVerification(user: { id: string; email: string }) {
  if (!isPlatformEmailConfigured()) return "not-configured" as const;

  const token = generateToken();
  await prisma.emailVerificationToken.create({
    data: { userId: user.id, token: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const email = verificationEmail(`${appUrl}/verify-email?token=${token}`);
  const sent = await sendPlatformEmail({ to: user.email, ...email });
  return sent ? ("sent" as const) : ("failed" as const);
}

/** Marks the account verified when the token is genuine, unused and fresh. */
export async function verifyEmailToken(rawToken: string): Promise<boolean> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { token: hashToken(rawToken) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) return false;

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);
  return true;
}
