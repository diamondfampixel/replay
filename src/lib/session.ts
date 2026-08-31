import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/client";
import {
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  generateToken,
  hashToken,
} from "@/lib/auth";
import { assertCan, type Capability } from "@/lib/permissions";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type ActiveContext = {
  user: SessionUser;
  organizationId: string;
  organizationName: string;
  organizationPlan: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  role: Role;
};

export async function createSession(userId: string, meta?: { userAgent?: string; ip?: string }) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 864e5);
  await prisma.session.create({
    data: {
      userId,
      token: hashToken(token),
      expiresAt,
      userAgent: meta?.userAgent?.slice(0, 255),
      ip: meta?.ip?.slice(0, 64),
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .deleteMany({ where: { token: hashToken(token) } })
      .catch(() => undefined);
  }
  jar.delete(SESSION_COOKIE);
}

/**
 * Drops every session for a user except the one making the request.
 *
 * A password change is how someone evicts an attacker, so leaving the older
 * cookies valid would defeat the point of it. The caller's own session is kept
 * so changing a password does not sign you out of the tab you are using.
 */
export async function revokeOtherSessions(userId: string): Promise<number> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const { count } = await prisma.session.deleteMany({
    where: {
      userId,
      ...(token ? { NOT: { token: hashToken(token) } } : {}),
    },
  });
  return count;
}

/** Cached per-request so repeated calls in a tree hit the database once. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    avatarUrl: session.user.avatarUrl,
  };
});

/**
 * Resolves the signed-in user together with the organization + store they are
 * operating on. Every admin query is scoped by the returned storeId, which is
 * what enforces tenant isolation.
 */
export const getActiveContext = cache(async (): Promise<ActiveContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      organization: {
        include: { stores: { orderBy: { createdAt: "asc" }, take: 1 } },
      },
    },
  });
  if (!membership) return null;
  const store = membership.organization.stores[0];
  if (!store) return null;

  return {
    user,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationPlan: membership.organization.plan,
    role: membership.role,
    storeId: store.id,
    storeSlug: store.slug,
    storeName: store.name,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Use in admin pages/actions. Redirects to login/onboarding when unavailable. */
export async function requireContext(): Promise<ActiveContext> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const ctx = await getActiveContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

export async function requireCapability(capability: Capability): Promise<ActiveContext> {
  const ctx = await requireContext();
  assertCan(ctx.role, capability);
  return ctx;
}
