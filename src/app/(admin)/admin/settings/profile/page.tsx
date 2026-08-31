import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireContext } from "@/lib/session";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/admin/profile-form";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const ctx = await requireContext();
  const [user, sessions] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } }),
    prisma.session.findMany({
      where: { userId: ctx.user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-4">
      <ProfileForm name={user.name} email={user.email} />

      <Card>
        <CardHeader><CardTitle>Your access</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-ink-500">Organization</span>
            <span className="text-ink-800">{ctx.organizationName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-500">Role</span>
            <Badge tone={ctx.role === "OWNER" ? "solid" : "outline"}>{ROLE_LABELS[ctx.role]}</Badge>
          </div>
          <p className="text-[12px] text-ink-500">{ROLE_DESCRIPTIONS[ctx.role]}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <span className="text-[12.5px] text-ink-500">{sessions.length}</span>
        </CardHeader>
        <CardContent className="space-y-2 text-[12.5px]">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-3 border-b border-ink-200 pb-2 last:border-0 last:pb-0">
              <span className="truncate text-ink-600">{session.userAgent ?? "Unknown device"}</span>
              <span className="shrink-0 text-ink-400">
                Started {formatDate(session.createdAt, "datetime")}
              </span>
            </div>
          ))}
          <p className="text-[11.5px] text-ink-400">
            Changing your password signs out every session, including this one.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
