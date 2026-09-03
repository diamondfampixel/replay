import { prisma } from "@/lib/db";
import { requireContext } from "@/lib/session";
import { AdminShell } from "@/components/admin/shell";
import { isAIConfigured } from "@/lib/ai/config";
import { VerifyEmailBanner } from "@/components/admin/verify-banner";
import { isPlatformAdmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();

  const account = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.user.id },
    select: { emailVerifiedAt: true },
  });

  const [notifications, aiConfigured] = await Promise.all([
    prisma.notification.findMany({
      where: { storeId: ctx.storeId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    isAIConfigured(ctx.storeId),
  ]);

  return (
    <AdminShell
      user={{ name: ctx.user.name, email: ctx.user.email }}
      organizationName={ctx.organizationName}
      storeName={ctx.storeName}
      storeSlug={ctx.storeSlug}
      role={ctx.role}
      aiConfigured={aiConfigured}
      platformAdmin={isPlatformAdmin(ctx.user.email)}
      notifications={notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        href: n.href,
        read: Boolean(n.readAt),
        createdAt: n.createdAt.toISOString(),
      }))}
    >
      {!account.emailVerifiedAt && <VerifyEmailBanner email={ctx.user.email} />}
      {children}
    </AdminShell>
  );
}
