"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/admin/confirm";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { initialsOf } from "@/lib/utils";
import { inviteMemberAction, removeMemberAction, updateMemberRoleAction } from "@/app/actions/settings";
import type { Role } from "@/generated/prisma/client";

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
};

const ROLES: Role[] = ["OWNER", "ADMIN", "MARKETING", "SUPPORT", "ANALYST"];

export function TeamManager({
  members, currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("MARKETING");
  const [pending, startTransition] = React.useTransition();
  const [confirmRemove, setConfirmRemove] = React.useState<Member | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Team</CardTitle>
            <p className="mt-0.5 text-[12.5px] text-ink-500">
              {members.length} member{members.length === 1 ? "" : "s"} in this organization
            </p>
          </div>
        </CardHeader>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Member</TH>
                <TH>Role</TH>
                <TH>Joined</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {members.map((member) => (
                <TR key={member.id}>
                  <TD>
                    <span className="flex items-center gap-2.5">
                      <span className="flex size-7 items-center justify-center rounded-full bg-ink-900 text-[11px] font-semibold text-white">
                        {initialsOf(member.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-medium text-ink-900">{member.name}</span>
                          {member.userId === currentUserId && <Badge tone="outline">you</Badge>}
                        </span>
                        <span className="block truncate text-[11.5px] text-ink-500">{member.email}</span>
                      </span>
                    </span>
                  </TD>
                  <TD>
                    <Select
                      value={member.role}
                      disabled={pending}
                      className="h-8 w-auto text-[12.5px]"
                      aria-label={`Role for ${member.name}`}
                      onChange={(event) =>
                        startTransition(async () => {
                          const result = await updateMemberRoleAction(member.id, event.target.value as Role);
                          if (!result.ok) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("Role updated");
                          router.refresh();
                        })
                      }
                    >
                      {ROLES.map((option) => (
                        <option key={option} value={option}>{ROLE_LABELS[option]}</option>
                      ))}
                    </Select>
                  </TD>
                  <TD className="whitespace-nowrap text-ink-500">{formatDate(member.joinedAt)}</TD>
                  <TD align="right">
                    {member.userId !== currentUserId && (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(member)}>
                        Remove
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      <Card>
        <CardHeader><CardTitle>Add a team member</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
            <Field label="Email" htmlFor="inviteEmail">
              <Input
                id="inviteEmail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@company.com"
              />
            </Field>
            <Field label="Role" htmlFor="inviteRole">
              <Select id="inviteRole" value={role} onChange={(event) => setRole(event.target.value as Role)}>
                {ROLES.map((option) => (
                  <option key={option} value={option}>{ROLE_LABELS[option]}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Button
            variant="primary"
            size="sm"
            loading={pending}
            disabled={!email.includes("@")}
            onClick={() =>
              startTransition(async () => {
                const result = await inviteMemberAction(email, role);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(result.message ?? "Added");
                setEmail("");
                router.refresh();
              })
            }
          >
            <UserPlus />
            Add to team
          </Button>

          <p className="text-[11.5px] text-ink-400">
            Email invitations are not implemented. The person needs a Halyard account first — once
            they have signed up, adding their address here gives them access immediately.
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title={`Remove ${confirmRemove?.name}?`}
        description="They lose access to this organization immediately. Their account and anything they created are kept."
        confirmLabel="Remove member"
        destructive
        loading={pending}
        onConfirm={() =>
          startTransition(async () => {
            if (!confirmRemove) return;
            const result = await removeMemberAction(confirmRemove.id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Team member removed");
            setConfirmRemove(null);
            router.refresh();
          })
        }
      />
    </>
  );
}
