import { prisma } from "@/lib/db";
import { requireContext } from "@/lib/session";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();

  const notifications = await prisma.notification.findMany({
    where: { storeId: ctx.storeId },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return (
    <AdminShell
      user={{ name: ctx.user.name, email: ctx.user.email }}
      organizationName={ctx.organizationName}
      storeName={ctx.storeName}
      storeSlug={ctx.storeSlug}
      role={ctx.role}
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
      {children}
    </AdminShell>
  );
}
