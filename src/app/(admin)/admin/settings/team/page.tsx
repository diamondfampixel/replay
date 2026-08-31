import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { ROLE_CAPABILITIES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamManager } from "@/components/admin/team-manager";
import type { Role } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Users & roles" };
export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const ctx = await requireCapability("team:manage");

  const memberships = await prisma.membership.findMany({
    where: { organizationId: ctx.organizationId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-4">
      <TeamManager
        currentUserId={ctx.user.id}
        members={memberships.map((membership) => ({
          id: membership.id,
          userId: membership.user.id,
          name: membership.user.name,
          email: membership.user.email,
          role: membership.role,
          joinedAt: membership.createdAt.toISOString(),
        }))}
      />

      <Card>
        <CardHeader><CardTitle>What each role can do</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
            <div key={role} className="border-b border-ink-200 pb-3 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <Badge tone={role === "OWNER" ? "solid" : "outline"}>{ROLE_LABELS[role]}</Badge>
                <span className="text-[12.5px] text-ink-600">{ROLE_DESCRIPTIONS[role]}</span>
              </div>
              <p className="mt-1.5 text-[11.5px] text-ink-400">
                {ROLE_CAPABILITIES[role].length} capabilities ·{" "}
                {ROLE_CAPABILITIES[role].filter((capability) => capability.endsWith(":write") || capability.endsWith(":manage")).length} write
              </p>
            </div>
          ))}
          <p className="text-[11.5px] text-ink-400">
            Roles are enforced server-side on every action and every AI tool call, not just hidden
            from the interface.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
